# S3 bucket for public product imagery (menus + ingredients).
# Images uploaded here are referenced by Menu.imageUrl / Ingredient.imageUrl in the DB.
# Bucket is configured for anonymous public read so the frontend can load images directly.

resource "aws_s3_bucket" "assets" {
  bucket = "${var.project_name}-assets"

  tags = {
    Project     = var.project_name
    Environment = var.environment
    Purpose     = "public-product-imagery"
  }
}

# Allow public access (disable all "block public" controls).
# Required so the bucket policy below can grant anonymous read.
resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Anonymous public read for all objects under the bucket.
resource "aws_s3_bucket_policy" "assets_public_read" {
  bucket = aws_s3_bucket.assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.assets.arn}/*"
      }
    ]
  })

  # Bucket policy can only be applied after the public access block is relaxed.
  depends_on = [aws_s3_bucket_public_access_block.assets]
}

# CORS so the frontend (GitHub Pages + localhost) can fetch images via XHR/fetch if needed.
# Simple <img> tag loads do not require CORS, but this keeps the door open for canvas/PDF embed flows.
resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}
