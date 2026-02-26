import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_event_sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3vectors from 'aws-cdk-lib/aws-s3vectors';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import {Construct} from 'constructs';

export class SurveyAnalysisStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        cdk.Tags.of(this).add('project', 'SurveyAnalysisAgent');
        cdk.Tags.of(this).add('managedBy', 'cdk');

        // ========================================
        // Cognito User Pool
        // ========================================
        const userPool = new cognito.UserPool(this, 'SurveyAnalysisUserPool', {
            userPoolName: 'survey-analysis-users',
            selfSignUpEnabled: false, // Admin creates users
            signInAliases: {
                email: true,
                username: false,
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
                givenName: {
                    required: true,
                    mutable: true,
                },
                familyName: {
                    required: true,
                    mutable: true,
                },
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            autoVerify: {
                email: true,
            },
            userInvitation: {
                emailSubject: 'Welcome to Survey Analysis Platform',
                emailBody: 'Hello {username}, you have been invited to join the Survey Analysis Platform. Your temporary password is {####}',
            },
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        // User Pool Client (for the web app)
        const userPoolClient = new cognito.UserPoolClient(this, 'SurveyAnalysisUserPoolClient', {
            userPool: userPool,
            userPoolClientName: 'survey-analysis-web-client',
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
            generateSecret: false,
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.PROFILE,
                ],
                callbackUrls: [
                    'http://localhost:5173', // Vite dev server
                ],
                logoutUrls: [
                    'http://localhost:5173',
                ],
            },
            accessTokenValidity: cdk.Duration.hours(1),
            idTokenValidity: cdk.Duration.hours(1),
            refreshTokenValidity: cdk.Duration.days(30),
        });

        // ========================================
        // DynamoDB Table for Jobs
        // ========================================
        const jobsTable = new dynamodb.Table(this, 'JobsTable', {
            tableName: 'survey-analysis-jobs',
            partitionKey: {
                name: 'jobId',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        cdk.Tags.of(jobsTable).add('project', 'SurveyAnalysisAgent');
        cdk.Tags.of(jobsTable).add('managedBy', 'cdk');

        // ========================================
        // S3 Vectors for Semantic Search
        // ========================================

        // Vector Bucket
        const vectorBucket = new s3vectors.CfnVectorBucket(this, 'SurveyVectorBucket', {
            vectorBucketName: 'survey-analysis-vectors',
            encryptionConfiguration: {
                sseType: 'AES256',
            },
        });
        vectorBucket.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

        // Vector Index for survey responses
        const vectorIndex = new s3vectors.CfnIndex(this, 'SurveyVectorIndex', {
            vectorBucketName: vectorBucket.vectorBucketName!,
            indexName: 'survey-responses',
            dataType: 'float32',
            dimension: 1024,
            distanceMetric: 'cosine',
        });
        vectorIndex.addDependency(vectorBucket);
        vectorIndex.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

        // ========================================
        // Lambda Function for Survey Agent
        // ========================================

        // Create Lambda execution role
        const agentLambdaRole = new iam.Role(this, 'AgentLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Execution role for survey agent Lambda',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });

        // S3 Vectors permissions (read-only)
        agentLambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3vectors:GetVectors',
                's3vectors:QueryVectors'
            ],
            resources: [vectorBucket.attrVectorBucketArn, vectorIndex.attrIndexArn],
        }));

        // Bedrock permissions (Claude Sonnet for agent + Titan for query embeddings)
        agentLambdaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:InvokeModel'],
            resources: [
                `arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0`,
                `arn:aws:bedrock:*:${this.account}:*`,
            ],
        }));

        // DynamoDB permissions for job updates
        jobsTable.grantReadWriteData(agentLambdaRole);

        // Create Lambda function
        const agentLambda = new lambda.Function(this, 'AgentLambda', {
            functionName: 'survey-analysis-agent',
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromAsset(
                path.join(__dirname, '../../backend'),
                {
                    bundling: {
                        image: lambda.Runtime.PYTHON_3_13.bundlingImage,
                        platform: 'linux/amd64',
                        command: [
                            'bash', '-c',
                            [
                                // Install dependencies
                                'cd /asset-input/lambdas/survey_agent',
                                'pip install -r requirements.txt -t /asset-output --no-cache-dir',
                                'cp handler.py /asset-output/',
                                'cp __init__.py /asset-output/',
                                'mkdir -p /asset-output/backend/core',
                                'cp -r /asset-input/core /asset-output/backend/',
                                'touch /asset-output/backend/__init__.py'
                            ].join(' && ')
                        ],
                    },
                }
            ),
            role: agentLambdaRole,
            timeout: cdk.Duration.minutes(5),
            memorySize: 512,
            reservedConcurrentExecutions: 10,
            environment: {
                S3_VECTOR_BUCKET_NAME: vectorBucket.vectorBucketName!,
                S3_VECTOR_INDEX_NAME: vectorIndex.indexName!,
                BEDROCK_MODEL_NAME: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
                JOBS_TABLE_NAME: jobsTable.tableName,
                LOG_LEVEL: 'INFO',
                POWERTOOLS_SERVICE_NAME: 'survey-agent',
            },
            description: 'Survey analysis agent with semantic search capabilities',
        });

        // Add consistent tags
        cdk.Tags.of(agentLambda).add('project', 'SurveyAnalysisAgent');
        cdk.Tags.of(agentLambda).add('managedBy', 'cdk');

        // ========================================
        // Lambda Function for Job Initiator
        // ========================================
        const jobInitiatorRole = new iam.Role(this, 'JobInitiatorLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Execution role for job initiator Lambda',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });

        // DynamoDB permissions
        jobsTable.grantReadWriteData(jobInitiatorRole);

        const jobInitiatorLambda = new lambda.Function(this, 'JobInitiatorLambda', {
            functionName: 'survey-analysis-job-initiator',
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromAsset(
                path.join(__dirname, '../../backend'),
                {
                    bundling: {
                        image: lambda.Runtime.PYTHON_3_13.bundlingImage,
                        platform: 'linux/amd64',
                        command: [
                            'bash', '-c',
                            [
                                'cd /asset-input/lambdas/job_initiator',
                                'pip install -r requirements.txt -t /asset-output --no-cache-dir',
                                'cp -au . /asset-output',
                                'mkdir -p /asset-output/backend/core',
                                'cp -r /asset-input/core /asset-output/backend/',
                                'touch /asset-output/backend/__init__.py'
                            ].join(' && ')
                        ],
                    },
                }
            ),
            role: jobInitiatorRole,
            timeout: cdk.Duration.seconds(10),
            memorySize: 256,
            environment: {
                JOBS_TABLE_NAME: jobsTable.tableName,
                AGENT_LAMBDA_NAME: 'survey-analysis-agent',
                LOG_LEVEL: 'INFO',
                POWERTOOLS_SERVICE_NAME: 'job-initiator',
            },
            description: 'Creates jobs and invokes agent Lambda asynchronously',
        });

        cdk.Tags.of(jobInitiatorLambda).add('project', 'SurveyAnalysisAgent');
        cdk.Tags.of(jobInitiatorLambda).add('managedBy', 'cdk');

        // Grant Job Initiator permission to invoke Agent Lambda
        agentLambda.grantInvoke(jobInitiatorRole);
        // ========================================
        // Lambda Function for Status Checker
        // ========================================
        const statusCheckerRole = new iam.Role(this, 'StatusCheckerLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Execution role for status checker Lambda',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });

        // DynamoDB read permissions
        jobsTable.grantReadData(statusCheckerRole);

        const statusCheckerLambda = new lambda.Function(this, 'StatusCheckerLambda', {
            functionName: 'survey-analysis-status-checker',
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromAsset(
                path.join(__dirname, '../../backend'),
                {
                    bundling: {
                        image: lambda.Runtime.PYTHON_3_13.bundlingImage,
                        platform: 'linux/amd64',
                        command: [
                            'bash', '-c',
                            [
                                'cd /asset-input/lambdas/status_checker',
                                'pip install -r requirements.txt -t /asset-output --no-cache-dir',
                                'cp -au . /asset-output',
                                'mkdir -p /asset-output/backend/core',
                                'cp -r /asset-input/core /asset-output/backend/',
                                'touch /asset-output/backend/__init__.py'
                            ].join(' && ')
                        ],
                    },
                }
            ),
            role: statusCheckerRole,
            timeout: cdk.Duration.seconds(10),
            memorySize: 256,
            environment: {
                JOBS_TABLE_NAME: jobsTable.tableName,
                LOG_LEVEL: 'INFO',
                POWERTOOLS_SERVICE_NAME: 'status-checker',
            },
            description: 'Returns job status from DynamoDB',
        });

        cdk.Tags.of(statusCheckerLambda).add('project', 'SurveyAnalysisAgent');
        cdk.Tags.of(statusCheckerLambda).add('managedBy', 'cdk');

        // ========================================
        // API Gateway with Cognito Authorizer
        // ========================================

        // Cognito authorizer
        const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
            cognitoUserPools: [userPool],
            authorizerName: 'SurveyAnalysisCognitoAuthorizer',
        });

        // REST API
        const api = new apigateway.RestApi(this, 'SurveyAnalysisApi', {
            restApiName: 'Survey Analysis API',
            description: 'API for survey analysis agent',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                ],
            },
        });
        api.addGatewayResponse('Default4xxResponse', {
            type: apigateway.ResponseType.DEFAULT_4XX,
            responseHeaders: {
                'Access-Control-Allow-Origin': "'*'",
                'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
            },
        });

        api.addGatewayResponse('Default5xxResponse', {
            type: apigateway.ResponseType.DEFAULT_5XX,
            responseHeaders: {
                'Access-Control-Allow-Origin': "'*'",
                'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
            },
        });

        // /jobs endpoint - job initiator with Cognito auth
        const jobsResource = api.root.addResource('jobs');
        jobsResource.addMethod('POST', new apigateway.LambdaIntegration(jobInitiatorLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // /jobs/{jobId} endpoint - status checker with Cognito auth
        const jobIdResource = jobsResource.addResource('{jobId}');
        jobIdResource.addMethod('GET', new apigateway.LambdaIntegration(statusCheckerLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // ========================================
        // S3 Bucket for Data (Input CSV + Output Results)
        // ========================================
        const dataBucket = new s3.Bucket(this, 'DataBucket', {
            bucketName: 'survey-agent-data',
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                },
            ],
        });

        // ========================================
        // Lambda Function for CSV Upload Processing
        // ========================================

        // Create Lambda execution role
        const csvProcessorRole = new iam.Role(this, 'CsvProcessorLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Execution role for CSV upload processor Lambda',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });

        // Grant Lambda read access to CSV uploads bucket
        dataBucket.grantRead(csvProcessorRole);

        // Create Lambda function
        const csvProcessorLambda = new lambda.Function(this, 'CsvUploadProcessorLambda', {
            functionName: 'survey-analysis-csv-processor',
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromAsset(
                path.join(__dirname, '../../backend'),
                {
                    bundling: {
                        image: lambda.Runtime.PYTHON_3_13.bundlingImage,
                        platform: 'linux/amd64',
                        command: [
                            'bash', '-c',
                            'cd /asset-input/lambdas/csv_upload_handler && ' +
                            'pip install -r requirements.txt -t /asset-output --no-cache-dir && ' +
                            'cp -au . /asset-output && ' +
                            'mkdir -p /asset-output/backend/core && ' +
                            'cp -r /asset-input/core /asset-output/backend/ && ' +
                            'touch /asset-output/backend/__init__.py'
                        ],
                    },
                }
            ),
            role: csvProcessorRole,
            timeout: cdk.Duration.minutes(2),
            memorySize: 512,
            environment: {
                CSV_UPLOADS_BUCKET: dataBucket.bucketName,
                LOG_LEVEL: 'INFO',
                POWERTOOLS_SERVICE_NAME: 'csv-processor',
            },
            description: 'Processes CSV files uploaded to csv-uploads bucket',
        });

        // Add consistent tags
        cdk.Tags.of(csvProcessorLambda).add('project', 'SurveyAnalysisAgent');
        cdk.Tags.of(csvProcessorLambda).add('managedBy', 'cdk');

        // Configure S3 event notification - only trigger for input/ prefix
        dataBucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3n.LambdaDestination(csvProcessorLambda),
            {prefix: 'input/'}
        );

        // Grant Agent Lambda S3 permissions for output files
        dataBucket.grantReadWrite(agentLambdaRole, 'output/*');

        // Add OUTPUT_BUCKET_NAME environment variable to Agent Lambda
        agentLambda.addEnvironment('OUTPUT_BUCKET_NAME', dataBucket.bucketName);

        // ========================================
        // SQS Queue for CSV Chunk Processing
        // ========================================

        // Dead Letter Queue for failed messages
        const csvChunkDLQ = new sqs.Queue(this, 'CsvChunkDeadLetterQueue', {
            queueName: 'survey-analysis-csv-chunks-dlq',
            retentionPeriod: cdk.Duration.days(14),
        });

        // Main queue for CSV chunks
        const csvChunkQueue = new sqs.Queue(this, 'CsvChunkQueue', {
            queueName: 'survey-analysis-csv-chunks',
            visibilityTimeout: cdk.Duration.minutes(5),
            retentionPeriod: cdk.Duration.days(4),
            receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
            deadLetterQueue: {
                queue: csvChunkDLQ,
                maxReceiveCount: 3,
            },
        });

        // Grant Lambda permission to send messages
        csvChunkQueue.grantSendMessages(csvProcessorRole);

        // Add SQS queue environment variables to Lambda
        csvProcessorLambda.addEnvironment('CHUNK_QUEUE_URL', csvChunkQueue.queueUrl);
        csvProcessorLambda.addEnvironment('CHUNK_SIZE', '500');

        // Add consistent tags
        cdk.Tags.of(csvChunkQueue).add('project', 'SurveyAnalysisAgent');
        cdk.Tags.of(csvChunkQueue).add('managedBy', 'cdk');

        cdk.Tags.of(csvChunkDLQ).add('project', 'SurveyAnalysisAgent');
        cdk.Tags.of(csvChunkDLQ).add('managedBy', 'cdk');

        // ========================================
        // Lambda Function for Embedding Consumer
        // ========================================

        // Create Lambda execution role
        const embeddingConsumerRole = new iam.Role(this, 'EmbeddingConsumerLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Execution role for embedding consumer Lambda',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });

        // Grant permissions
        dataBucket.grantRead(embeddingConsumerRole);
        csvChunkQueue.grantConsumeMessages(embeddingConsumerRole);

        // S3 Vectors permissions
        embeddingConsumerRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3vectors:PutVectors', 's3vectors:GetVectors'],
            resources: [vectorBucket.attrVectorBucketArn, vectorIndex.attrIndexArn],
        }));

        // Bedrock permissions
        embeddingConsumerRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:InvokeModel'],
            resources: [`arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`],
        }));

        // Create Lambda function
        const embeddingConsumerLambda = new lambda.Function(this, 'EmbeddingConsumerLambda', {
            functionName: 'survey-analysis-embedding-consumer',
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromAsset(
                path.join(__dirname, '../../backend'),
                {
                    bundling: {
                        image: lambda.Runtime.PYTHON_3_13.bundlingImage,
                        platform: 'linux/amd64',
                        command: [
                            'bash', '-c',
                            'cd /asset-input/lambdas/embedding_consumer && ' +
                            'pip install -r requirements.txt -t /asset-output --no-cache-dir && ' +
                            'cp -au . /asset-output && ' +
                            'mkdir -p /asset-output/backend/core && ' +
                            'cp -r /asset-input/core /asset-output/backend/ && ' +
                            'touch /asset-output/backend/__init__.py'
                        ],
                    },
                }
            ),
            role: embeddingConsumerRole,
            timeout: cdk.Duration.minutes(5),
            memorySize: 1024,
            reservedConcurrentExecutions: 5,
            environment: {
                CSV_UPLOADS_BUCKET: dataBucket.bucketName,
                S3_VECTOR_BUCKET_NAME: vectorBucket.vectorBucketName!,
                S3_VECTOR_INDEX_NAME: 'survey-responses',
                EMBEDDING_MAX_WORKERS: '1',
                EMBEDDING_RATE_LIMIT_RETRIES: '5',
                EMBEDDING_BATCH_SIZE: '100',
                LOG_LEVEL: 'INFO',
                POWERTOOLS_SERVICE_NAME: 'embedding-consumer',
            },
            description: 'Processes CSV chunks and generates embeddings v1.1',
        });

        // Configure SQS event source
        embeddingConsumerLambda.addEventSource(
            new lambda_event_sources.SqsEventSource(csvChunkQueue, {
                batchSize: 1,
                maxBatchingWindow: cdk.Duration.seconds(0),
                reportBatchItemFailures: true,
                maxConcurrency: 5,
            })
        );

        // Add consistent tags
        cdk.Tags.of(embeddingConsumerLambda).add('project', 'SurveyAnalysisAgent');
        cdk.Tags.of(embeddingConsumerLambda).add('managedBy', 'cdk');

        // ========================================
        // Amplify Hosting
        // ========================================
        const amplifyApp = new amplify.CfnApp(this, 'SurveyAnalysisApp', {
            name: 'survey-analysis-frontend',
            platform: 'WEB',
            enableBranchAutoDeletion: true,
            buildSpec: `
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - 'node_modules/**/*'
`,
            customRules: [
                {
                    // SPA routing - redirect all non-file requests to index.html
                    source: '</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>',
                    target: '/index.html',
                    status: '200',
                },
            ],
            environmentVariables: [
                {
                    name: 'VITE_API_URL',
                    value: api.url,
                },
                {
                    name: 'VITE_USER_POOL_ID',
                    value: userPool.userPoolId,
                },
                {
                    name: 'VITE_USER_POOL_CLIENT_ID',
                    value: userPoolClient.userPoolClientId,
                },
                {
                    name: 'VITE_AWS_REGION',
                    value: this.region,
                },
            ],
        });

        // Create main branch for manual deployments
        const mainBranch = new amplify.CfnBranch(this, 'MainBranch', {
            appId: amplifyApp.attrAppId,
            branchName: 'main',
            enableAutoBuild: false,
            stage: 'PRODUCTION',
        });

        // ========================================
        // Outputs
        // ========================================
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: userPool.userPoolId,
            description: 'Cognito User Pool ID',
        });

        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID',
        });

        new cdk.CfnOutput(this, 'ApiUrl', {
            value: api.url,
            description: 'API Gateway URL',
        });

        new cdk.CfnOutput(this, 'AwsRegion', {
            value: this.region,
            description: 'AWS Region',
        });

        new cdk.CfnOutput(this, 'AmplifyAppUrl', {
            value: `https://${mainBranch.branchName}.${amplifyApp.attrAppId}.amplifyapp.com`,
            description: 'Amplify App URL',
        });

        new cdk.CfnOutput(this, 'VectorBucketName', {
            value: vectorBucket.vectorBucketName!,
            description: 'S3 Vectors Bucket Name',
        });

        new cdk.CfnOutput(this, 'VectorBucketArn', {
            value: vectorBucket.attrVectorBucketArn,
            description: 'S3 Vectors Bucket ARN',
        });

        new cdk.CfnOutput(this, 'VectorIndexName', {
            value: 'survey-responses',
            description: 'S3 Vectors Index Name',
        });

        new cdk.CfnOutput(this, 'VectorIndexArn', {
            value: vectorIndex.attrIndexArn,
            description: 'S3 Vectors Index ARN',
        });

        new cdk.CfnOutput(this, 'DataBucketName', {
            value: dataBucket.bucketName,
            description: 'S3 Bucket Name for Data (Input/Output)',
        });

        new cdk.CfnOutput(this, 'DataBucketArn', {
            value: dataBucket.bucketArn,
            description: 'S3 Bucket ARN for Data (Input/Output)',
        });

        new cdk.CfnOutput(this, 'CsvProcessorLambdaArn', {
            value: csvProcessorLambda.functionArn,
            description: 'ARN of CSV processor Lambda function',
        });

        new cdk.CfnOutput(this, 'CsvProcessorLambdaName', {
            value: csvProcessorLambda.functionName,
            description: 'Name of CSV processor Lambda function',
        });

        new cdk.CfnOutput(this, 'CsvChunkQueueUrl', {
            value: csvChunkQueue.queueUrl,
            description: 'SQS Queue URL for CSV chunks',
        });

        new cdk.CfnOutput(this, 'CsvChunkQueueArn', {
            value: csvChunkQueue.queueArn,
            description: 'SQS Queue ARN for CSV chunks',
        });

        new cdk.CfnOutput(this, 'CsvChunkDLQUrl', {
            value: csvChunkDLQ.queueUrl,
            description: 'Dead Letter Queue URL for failed CSV chunks',
        });

        new cdk.CfnOutput(this, 'EmbeddingConsumerLambdaArn', {
            value: embeddingConsumerLambda.functionArn,
            description: 'ARN of embedding consumer Lambda function',
        });

        new cdk.CfnOutput(this, 'EmbeddingConsumerLambdaName', {
            value: embeddingConsumerLambda.functionName,
            description: 'Name of embedding consumer Lambda function',
        });

        // Agent Lambda outputs
        new cdk.CfnOutput(this, 'AgentLambdaArn', {
            value: agentLambda.functionArn,
            description: 'ARN of survey agent Lambda function',
        });

        new cdk.CfnOutput(this, 'AgentLambdaName', {
            value: agentLambda.functionName,
            description: 'Name of survey agent Lambda function',
        });

        // Jobs table outputs
        new cdk.CfnOutput(this, 'JobsTableName', {
            value: jobsTable.tableName,
            description: 'DynamoDB table name for jobs',
        });

        new cdk.CfnOutput(this, 'JobsTableArn', {
            value: jobsTable.tableArn,
            description: 'DynamoDB table ARN for jobs',
        });

        // Job Initiator Lambda outputs
        new cdk.CfnOutput(this, 'JobInitiatorLambdaArn', {
            value: jobInitiatorLambda.functionArn,
            description: 'ARN of job initiator Lambda function',
        });

        new cdk.CfnOutput(this, 'JobInitiatorLambdaName', {
            value: jobInitiatorLambda.functionName,
            description: 'Name of job initiator Lambda function',
        });

        // Status Checker Lambda outputs
        new cdk.CfnOutput(this, 'StatusCheckerLambdaArn', {
            value: statusCheckerLambda.functionArn,
            description: 'ARN of status checker Lambda function',
        });

        new cdk.CfnOutput(this, 'StatusCheckerLambdaName', {
            value: statusCheckerLambda.functionName,
            description: 'Name of status checker Lambda function',
        });
    }
}
