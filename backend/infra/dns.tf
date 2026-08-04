# DNS and TLS for the Aristaeus web frontend.
#
# One Route 53 zone holds every environment. Terraform reads that zone. It does not
# create it, for two reasons:
#   1. The CI workflow passes only database_url, environment and aws_region. A flag
#      that controls the zone would read as false in CI and destroy the zone.
#   2. A shared zone must outlive any single environment. `terraform destroy` on dev
#      must never delete the DNS records of prod.
#
# Create the zone one time with the AWS CLI:
#   aws route53 create-hosted-zone --name algramo.app --caller-reference "$(date +%s)"
#
# Each environment gets one certificate for its own level:
#   prod: algramo.app and *.algramo.app
#   dev:  dev.algramo.app and *.dev.algramo.app
# The wildcard covers a new hostname, so a new subdomain needs no certificate work.

locals {
  # True when this environment sits at the zone apex. Only the apex gets a www record.
  is_apex = var.domain_name == var.hosted_zone_name

  site_domain  = var.domain_name
  www_domain   = "www.${var.domain_name}"
  admin_domain = "admin.${var.domain_name}"

  site_aliases  = local.is_apex ? [local.site_domain, local.www_domain] : [local.site_domain]
  admin_aliases = var.admin_dns_enabled ? [local.admin_domain] : []
}

data "aws_route53_zone" "main" {
  name         = var.hosted_zone_name
  private_zone = false
}

locals {
  zone_id = data.aws_route53_zone.main.zone_id
}

# ============================================
# ACM certificate
# ============================================

resource "aws_acm_certificate" "main" {
  provider = aws.us_east_1

  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Caution: ACM validation waits until the zone answers public queries.
# Point the registrar nameservers at this zone before you apply.
# If the delegation is absent, the apply stops here and gives no error.
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for option in aws_acm_certificate.main.domain_validation_options :
    option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  }

  zone_id         = local.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "main" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# ============================================
# Alias records
# ============================================

resource "aws_route53_record" "site_a" {
  zone_id = local.zone_id
  name    = local.site_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "site_aaaa" {
  zone_id = local.zone_id
  name    = local.site_domain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# The www record points at the same distribution.
# A CloudFront function returns a 301 redirect to the apex.
resource "aws_route53_record" "www_a" {
  count   = local.is_apex ? 1 : 0
  zone_id = local.zone_id
  name    = local.www_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_aaaa" {
  count   = local.is_apex ? 1 : 0
  zone_id = local.zone_id
  name    = local.www_domain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# The admin record stays absent until var.admin_dns_enabled is true.
# The admin UI reads customer data and the orders API has no authentication.
# Reach the admin distribution through its CloudFront domain until then.
resource "aws_route53_record" "admin_a" {
  count   = var.admin_dns_enabled ? 1 : 0
  zone_id = local.zone_id
  name    = local.admin_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.admin.domain_name
    zone_id                = aws_cloudfront_distribution.admin.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "admin_aaaa" {
  count   = var.admin_dns_enabled ? 1 : 0
  zone_id = local.zone_id
  name    = local.admin_domain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.admin.domain_name
    zone_id                = aws_cloudfront_distribution.admin.hosted_zone_id
    evaluate_target_health = false
  }
}
