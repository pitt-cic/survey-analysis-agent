#!/bin/bash

# Survey Analysis Agent - Deployment Script
# This script provides options to deploy infrastructure, upload data, and invite users

set -e

# ========================================
# Configuration
# ========================================
STACK_NAME="SurveyAnalysisStack"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_BUCKET="survey-agent-data"

# Required columns (upload blocked if missing)
REQUIRED_COLS=("TEXT_ANSWER" "QUESTION_TYPE")

# Metadata columns (warning if missing, but upload allowed)
METADATA_COLS=("QUESTION" "EVENTNAME" "EVENTCODE" "NPS_GROUP" "RESPONSEID")

# ========================================
# Helper Functions
# ========================================

get_stack_output() {
    local output_key=$1
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    echo ""

    # Check if running from project root
    if [ ! -f "$SCRIPT_DIR/infrastructure/cdk.json" ]; then
        echo "❌ Please run this script from the project root directory."
        exit 1
    fi
    echo "✅ Running from project root"

    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        echo "❌ AWS CLI not found. Please install AWS CLI."
        echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi
    echo "✅ AWS CLI installed"

    # Check if AWS CLI is configured
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        echo "❌ AWS CLI not configured. Please run 'aws configure' first."
        exit 1
    fi
    echo "✅ AWS CLI configured"

    echo ""
}

check_stack_deployed() {
    local user_pool_id=$(get_stack_output "UserPoolId")
    if [ -z "$user_pool_id" ]; then
        echo "❌ Stack '$STACK_NAME' not found or not fully deployed."
        echo "   Please run option 1 to deploy the infrastructure first."
        return 1
    fi
    return 0
}

validate_csv() {
    local csv_file=$1
    local header=$(head -1 "$csv_file")
    local missing_required=()
    local missing_metadata=()

    # Check required columns
    for col in "${REQUIRED_COLS[@]}"; do
        if ! echo "$header" | grep -q "$col"; then
            missing_required+=("$col")
        fi
    done

    # Check metadata columns
    for col in "${METADATA_COLS[@]}"; do
        if ! echo "$header" | grep -q "$col"; then
            missing_metadata+=("$col")
        fi
    done

    # Report results
    if [ ${#missing_required[@]} -gt 0 ]; then
        echo ""
        echo "❌ Missing required columns: ${missing_required[*]}"
        echo ""
        echo "   These columns are required for the embedding process to work."
        return 1
    fi

    if [ ${#missing_metadata[@]} -gt 0 ]; then
        echo ""
        echo "⚠️  Missing metadata columns: ${missing_metadata[*]}"
        echo "   These fields will be stored as empty values."
        echo ""
        read -p "Type 'continue' to proceed, or anything else to cancel: " confirm
        if [ "$confirm" != "continue" ]; then
            echo "❌ Upload cancelled."
            exit 1
        fi
    fi

    return 0
}

show_menu() {
    echo ""
    echo "=========================================="
    echo "  Survey Analysis Agent - Deploy Script"
    echo "=========================================="
    echo ""
    echo "  1) Deploy Infrastructure & Frontend"
    echo "  2) Describe Deployment"
    echo "  3) Upload Survey Data"
    echo "  4) Invite User"
    echo "  5) Exit"
    echo ""
}

# ========================================
# Option 1: Deploy Infrastructure & Frontend
# ========================================

deploy_all() {
    echo ""
    echo "🚀 Starting full deployment..."
    echo ""

    # Check prerequisites
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found. Please install Node.js v18 or later."
        return 1
    fi

    if ! command -v docker &> /dev/null; then
        echo "❌ Docker not found. Please install Docker Desktop."
        return 1
    fi

    if ! docker info &> /dev/null; then
        echo "❌ Docker is not running. Please start Docker Desktop."
        return 1
    fi

    # Check if already deployed
    local existing_pool=$(get_stack_output "UserPoolId")
    if [ -n "$existing_pool" ]; then
        echo "⚠️  Stack '$STACK_NAME' is already deployed."
        read -p "Type 'redeploy' to redeploy, or anything else to cancel: " confirm
        if [ "$confirm" != "redeploy" ]; then
            echo "❌ Deployment cancelled."
            return 1
        fi
        echo ""
    fi

    # Deploy infrastructure
    echo "📋 Step 1: Deploying infrastructure with CDK..."
    echo ""

    cd "$SCRIPT_DIR/infrastructure"

    if [ ! -d "node_modules" ]; then
        echo "📦 Installing CDK dependencies..."
        npm install
    fi

    echo "🏗️  Running CDK deploy..."
    npx cdk deploy --require-approval never

    echo ""
    echo "✅ Infrastructure deployed successfully!"
    echo ""

    # Deploy frontend
    echo "📋 Step 2: Deploying frontend..."
    echo ""

    cd "$SCRIPT_DIR/frontend"

    if [ ! -x "./deploy-frontend.sh" ]; then
        chmod +x ./deploy-frontend.sh
    fi

    ./deploy-frontend.sh

    cd "$SCRIPT_DIR"

    echo ""
    echo "=========================================="
    echo "🎉 Full deployment completed!"
    echo "=========================================="
    echo ""
}

describe_deployment(){
    echo ""
    echo "🏗️  Describe Deployment"
    echo ""

    # Check if stack is deployed
    if ! check_stack_deployed; then
        return 1
    fi

    # Display outputs
    local api_url=$(get_stack_output "ApiUrl")
    local amplify_url=$(get_stack_output "AmplifyAppUrl")
    local user_pool_id=$(get_stack_output "UserPoolId")
    local data_bucket=$(get_stack_output "DataBucketName")

    echo "📱 Application URL: $amplify_url"
    echo "🔗 API Gateway: $api_url"
    echo "🔐 User Pool ID: $user_pool_id"
    echo "📦 Data Bucket: $data_bucket"
    echo ""
}

# ========================================
# Option 3: Upload Survey Data
# ========================================

upload_data() {
    echo ""
    echo "📤 Upload Survey Data"
    echo ""

    # Check if stack is deployed
    if ! check_stack_deployed; then
        return 1
    fi

    # Prompt for file path
    read -p "Enter the path to your CSV file: " csv_file

    # Expand tilde if present
    csv_file="${csv_file/#\~/$HOME}"

    # Check if file exists
    if [ ! -f "$csv_file" ]; then
        echo "❌ File not found: $csv_file"
        return 1
    fi

    # Check if it's a CSV
    if [[ ! "$csv_file" =~ \.csv$ ]]; then
        echo "⚠️  Warning: File does not have .csv extension"
    fi

    echo ""
    echo "📋 Validating CSV columns..."

    # Validate CSV
    if ! validate_csv "$csv_file"; then
        echo ""
        echo "⚠️  Your CSV is missing required columns."
        echo "   Only force this upload if you have modified:"
        echo "   backend/core/services/embeddings_service.py"
        echo ""
        read -p "Type 'FORCE' to force upload, or anything else to cancel: " force_upload

        if [ "$force_upload" != "FORCE" ]; then
            echo "❌ Upload cancelled."
            return 1
        fi
        echo ""
    fi

    # Get just the filename for the upload
    local filename=$(basename "$csv_file")

    echo "🚀 Uploading to S3..."
    aws s3 cp "$csv_file" "s3://$DATA_BUCKET/input/$filename"

    echo ""
    echo "✅ Upload successful!"
    echo ""
    echo "   File: $filename"
    echo "   Location: s3://$DATA_BUCKET/input/$filename"
    echo ""
    echo "   The system will automatically process the data"
    echo "   and generate embeddings for semantic search."
    echo ""
}

# ========================================
# Option 4: Invite User
# ========================================

invite_user() {
    echo ""
    echo "👤 Invite User"
    echo ""

    # Check if stack is deployed
    if ! check_stack_deployed; then
        return 1
    fi

    # Get User Pool ID
    local user_pool_id=$(get_stack_output "UserPoolId")

    if [ -z "$user_pool_id" ]; then
        echo "❌ Could not retrieve User Pool ID from stack outputs."
        return 1
    fi

    # Prompt for email
    read -p "Enter the user's email address: " user_email

    # Basic email validation
    if [[ ! "$user_email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        echo "❌ Invalid email format: $user_email"
        return 1
    fi

    echo ""
    echo "🚀 Creating user in Cognito..."

    # Create user
    if aws cognito-idp admin-create-user \
        --user-pool-id "$user_pool_id" \
        --username "$user_email" \
        --user-attributes Name=email,Value="$user_email" Name=email_verified,Value=true \
        --desired-delivery-mediums EMAIL > /dev/null 2>&1; then

        echo ""
        echo "✅ User invited successfully!"
        echo ""
        echo "   Email: $user_email"
        echo "   A temporary password has been sent to their inbox."
        echo "   On first login, they will set their password and name."
        echo ""
    else
        echo ""
        echo "❌ Failed to create user. The user may already exist."
        echo "   Check the AWS Console for more details."
        return 1
    fi
}

# ========================================
# Main
# ========================================

main() {
    check_prerequisites

    while true; do
        show_menu
        read -p "Select an option (1-5): " choice

        case $choice in
            1)
                deploy_all
                ;;
            2)
                describe_deployment
                ;;
            3)
                upload_data
                ;;
            4)
                invite_user
                ;;
            5)
                echo ""
                echo "👋 Goodbye!"
                echo ""
                exit 0
                ;;
            *)
                echo ""
                echo "❌ Invalid option. Please select 1-5."
                ;;
        esac
    done
}

main
