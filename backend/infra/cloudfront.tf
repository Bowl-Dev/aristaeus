# CloudFront distributions for the Aristaeus frontend.
#
# Two distributions read the same S3 bucket and the same API Gateway:
#   site  - the public store at the apex domain
#   admin - the orders UI at admin.<domain>
#
# The admin UI gets its own distribution so that a firewall, a WAF rule, or an
# authentication function can attach to it later. The public site stays untouched.
#
# Each distribution proxies /api/* to API Gateway. The browser therefore calls the API
# on its own origin, and the app needs no CORS.

# ============================================
# Managed policies
# ============================================

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# Caution: the /api/* behavior must not forward the viewer Host header.
# API Gateway rejects a request with a 403 when the Host does not match the
# execute-api endpoint. This policy forwards every other header.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

# ============================================
# Viewer-request function
# ============================================

resource "aws_cloudfront_function" "site_router" {
  name    = "${var.project_name}-site-router-${var.environment}"
  runtime = "cloudfront-js-2.0"
  comment = "Redirects www to the apex and hides /admin on the public site"
  publish = true

  code = templatefile("${path.module}/functions/site-router.js.tftpl", {
    apex_domain = local.site_domain
  })
}

locals {
  s3_origin_id  = "s3-web"
  api_origin_id = "api-gateway"

  # api_endpoint arrives as an https URL. CloudFront wants the hostname alone.
  api_origin_domain = replace(aws_apigatewayv2_api.main.api_endpoint, "https://", "")
}

# ============================================
# Public site distribution
# ============================================

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} public site (${var.environment})"
  default_root_object = "index.html"
  aliases             = local.site_aliases

  # Colombia sits in South America, which PriceClass_100 and PriceClass_200 exclude.
  price_class = "PriceClass_All"

  origin {
    origin_id                = local.s3_origin_id
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  origin {
    origin_id   = local.api_origin_id
    domain_name = local.api_origin_domain

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.site_router.arn
    }
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = local.api_origin_id
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    compress                 = true
  }

  # The frontend is a single-page app. S3 with OAC answers 403 for an absent key,
  # not 404, so both codes must return the app shell.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.main.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    Purpose     = "public-site"
  }
}

# ============================================
# Admin distribution
# ============================================

resource "aws_cloudfront_distribution" "admin" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} admin UI (${var.environment})"
  default_root_object = "index.html"
  aliases             = local.admin_aliases
  price_class         = "PriceClass_All"

  origin {
    origin_id                = local.s3_origin_id
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  origin {
    origin_id   = local.api_origin_id
    domain_name = local.api_origin_domain

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = local.api_origin_id
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    compress                 = true
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # The default CloudFront certificate applies while the admin hostname is absent.
  # An ACM certificate needs at least one alias.
  viewer_certificate {
    cloudfront_default_certificate = var.admin_dns_enabled ? null : true
    acm_certificate_arn            = var.admin_dns_enabled ? aws_acm_certificate_validation.main.certificate_arn : null
    ssl_support_method             = var.admin_dns_enabled ? "sni-only" : null
    minimum_protocol_version       = var.admin_dns_enabled ? "TLSv1.2_2021" : null
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    Purpose     = "admin-ui"
  }
}
