#!/bin/bash

# Deploy Frontend to AWS Amplify
# This script pulls CloudFormation outputs, generates environment config, and deploys to Amplify

set -e

# Configuration
STACK_NAME="SurveyAnalysisStack"
FRONTEND_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$FRONTEND_DIR/dist"

echo "🚀 Starting frontend deployment to AWS Amplify..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI and configure it."
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ Frontend directory not found at $FRONTEND_DIR"
    exit 1
fi

echo "📋 Fetching CloudFormation stack outputs..."

# Function to get stack output value
get_stack_output() {
    local output_key=$1
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

# Get all required outputs from CloudFormation
API_URL=$(get_stack_output "ApiUrl")
USER_POOL_ID=$(get_stack_output "UserPoolId")
USER_POOL_CLIENT_ID=$(get_stack_output "UserPoolClientId")
AMPLIFY_APP_URL=$(get_stack_output "AmplifyAppUrl")

# Try to get Amplify App ID directly, or parse from URL
AMPLIFY_APP_ID=$(get_stack_output "AmplifyAppId")
if [ -z "$AMPLIFY_APP_ID" ] && [ -n "$AMPLIFY_APP_URL" ]; then
    # Parse from URL format: https://main.d2nbu9v0j53q8o.amplifyapp.com
    AMPLIFY_APP_ID=$(echo "$AMPLIFY_APP_URL" | cut -d'.' -f2)
fi

# Validate required outputs
if [ -z "$AMPLIFY_APP_ID" ]; then
    echo "❌ Could not retrieve Amplify App ID from CloudFormation stack: $STACK_NAME"
    echo "   Make sure the stack has been deployed successfully."
    exit 1
fi

if [ -z "$API_URL" ]; then
    echo "❌ Could not retrieve API URL from CloudFormation stack: $STACK_NAME"
    exit 1
fi

echo "✅ Retrieved stack outputs:"
echo "   API URL: $API_URL"
echo "   User Pool ID: $USER_POOL_ID"
echo "   User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "   Amplify App ID: $AMPLIFY_APP_ID"
echo "   Amplify App URL: $AMPLIFY_APP_URL"

# Create .env.production file for the build
echo "📝 Creating production environment file..."
cat > "$FRONTEND_DIR/.env.production" << EOF
# Auto-generated production environment variables
# Generated on $(date)
# From CloudFormation stack: $STACK_NAME

VITE_API_URL=$API_URL
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_AWS_REGION=us-east-1
EOF

echo "✅ Created $FRONTEND_DIR/.env.production"

# Build the frontend
echo "🔨 Building frontend application..."
cd "$FRONTEND_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed successfully!"
else
    echo "✅ Dependencies are up to date."
fi

# Build the application
echo "🏗️  Running build command..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Build completed successfully"

# Go back to project root
cd - > /dev/null

# Create _redirects file for SPA support (client-side routing)
echo "📝 Creating _redirects file for SPA support..."
cat > "$BUILD_DIR/_redirects" << 'EOF'
/* /index.html 200
EOF

# Deploy to Amplify
echo "🚀 Deploying to AWS Amplify..."

# Create deployment package
DEPLOY_PACKAGE="/tmp/amplify-deploy-$(date +%Y%m%d-%H%M%S).zip"
echo "📦 Creating deployment package..."

cd "$BUILD_DIR"
zip -r "$DEPLOY_PACKAGE" . -x "*.DS_Store" > /dev/null
cd - > /dev/null

# Cancel any pending deployments
echo "🔍 Checking for pending deployments..."
PENDING_JOBS=$(aws amplify list-jobs --app-id "$AMPLIFY_APP_ID" --branch-name "main" --query "jobSummaries[?status=='PENDING'].jobId" --output text 2>/dev/null || echo "")

if [ -n "$PENDING_JOBS" ] && [ "$PENDING_JOBS" != "None" ]; then
    echo "⚠️  Cancelling pending deployments: $PENDING_JOBS"
    for JOB_ID in $PENDING_JOBS; do
        aws amplify stop-job --app-id "$AMPLIFY_APP_ID" --branch-name "main" --job-id "$JOB_ID" 2>/dev/null || true
    done
fi

# Create deployment and get upload URL
echo "📤 Creating deployment..."
DEPLOYMENT_RESPONSE=$(aws amplify create-deployment \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "main" \
    --output json)

JOB_ID=$(echo "$DEPLOYMENT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['jobId'])")
UPLOAD_URL=$(echo "$DEPLOYMENT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['zipUploadUrl'])")

if [ -z "$JOB_ID" ] || [ -z "$UPLOAD_URL" ]; then
    echo "❌ Failed to create Amplify deployment"
    rm -f "$DEPLOY_PACKAGE"
    exit 1
fi

echo "✅ Deployment created with Job ID: $JOB_ID"

# Upload the zip file
echo "📤 Uploading deployment package..."
if ! curl -s -X PUT -T "$DEPLOY_PACKAGE" "$UPLOAD_URL"; then
    echo "❌ Failed to upload deployment package"
    rm -f "$DEPLOY_PACKAGE"
    exit 1
fi

echo "✅ Deployment package uploaded successfully"

# Start the deployment
echo "🚀 Starting deployment..."
aws amplify start-deployment \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "main" \
    --job-id "$JOB_ID" > /dev/null

# Monitor deployment status
echo "⏳ Monitoring deployment status..."
while true; do
    JOB_STATUS=$(aws amplify get-job \
        --app-id "$AMPLIFY_APP_ID" \
        --branch-name "main" \
        --job-id "$JOB_ID" \
        --query 'job.summary.status' \
        --output text)

    case $JOB_STATUS in
        "SUCCEED")
            echo "✅ Deployment completed successfully!"
            break
            ;;
        "FAILED"|"CANCELLED")
            echo "❌ Deployment failed with status: $JOB_STATUS"
            rm -f "$DEPLOY_PACKAGE"
            exit 1
            ;;
        "RUNNING"|"PENDING")
            echo "⏳ Deployment in progress... (Status: $JOB_STATUS)"
            sleep 5
            ;;
        *)
            echo "⚠️  Unknown deployment status: $JOB_STATUS"
            sleep 5
            ;;
    esac
done

# Clean up
rm -f "$DEPLOY_PACKAGE"

echo ""
echo "=========================================="
echo "🎉 Frontend deployment completed!"
echo "=========================================="
echo ""
echo "📱 Application URL: $AMPLIFY_APP_URL"
echo "🔗 API Gateway: $API_URL"
echo ""
echo "🔐 Authentication:"
echo "   User Pool ID: $USER_POOL_ID"
echo "   Client ID: $USER_POOL_CLIENT_ID"
echo ""
