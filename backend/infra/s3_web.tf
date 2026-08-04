# S3 bucket for the built SvelteKit frontend.
#
# The bucket stays private. CloudFront reads it through an Origin Access Control (OAC).
# This bucket is different from the assets bucket in s3_assets.tf, which holds product
# imagery and is public.

resource "aws_s3_bucket" "web" {
  bucket = "${var.project_name}-web-${var.environment}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
    Purpose     = "static-frontend"
  }
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "web" {
  bucket = aws_s3_bucket.web.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${var.project_name}-web-oac-${var.environment}"
  description                       = "OAC for the ${var.environment} frontend bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Both distributions read this bucket. The condition limits access to these two.
resource "aws_s3_bucket_policy" "web_cloudfront_read" {
  bucket = aws_s3_bucket.web.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontRead"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.web.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = [
              aws_cloudfront_distribution.site.arn,
              aws_cloudfront_distribution.admin.arn
            ]
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.web]
}
