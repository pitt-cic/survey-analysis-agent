#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import {SurveyAnalysisStack} from '../lib/survey-analysis-stack';

const app = new cdk.App();
new SurveyAnalysisStack(app, 'SurveyAnalysisStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
    description: 'Survey Analysis Agent Infrastructure',
});
