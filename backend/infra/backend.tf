# Terraform Backend Configuration
# Uses S3 for state storage and DynamoDB for state locking
#
# The actual values are passed via -backend-config in the GitHub Actions workflow.
# This allows different state files for different environments.
#
# Required GitHub Repository Variables:
#   - TF_STATE_BUCKET: S3 bucket name for Terraform state
#   - TF_LOCK_TABLE: DynamoDB table name for state locking
#
# To bootstrap the backend resources, run these AWS CLI commands:
#
#   # Create S3 bucket (replace ACCOUNT_ID with your AWS account ID)
#   aws s3 mb s3://aristaeus-terraform-state-ACCOUNT_ID --region us-east-1
#
#   # Enable versioning
#   aws s3api put-bucket-versioning \
#     --bucket aristaeus-terraform-state-ACCOUNT_ID \
#     --versioning-configuration Status=Enabled
#
#   # Enable encryption
#   aws s3api put-bucket-encryption \
#     --bucket aristaeus-terraform-state-ACCOUNT_ID \
#     --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
#
#   # Create DynamoDB table for state locking
#   aws dynamodb create-table \
#     --table-name aristaeus-terraform-locks \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST \
#     --region us-east-1

terraform {
  backend "s3" {
    # Values provided via -backend-config in CI/CD
    # bucket         = "aristaeus-terraform-state-ACCOUNT_ID"
    # key            = "backend/dev/terraform.tfstate"
    # region         = "us-east-1"
    # encrypt        = true
    # dynamodb_table = "aristaeus-terraform-locks"
  }
}
