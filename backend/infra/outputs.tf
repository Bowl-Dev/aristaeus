# Outputs for Aristaeus Backend Infrastructure

# ============================================
# Frontend hosting
# ============================================

output "site_url" {
  description = "Public URL of the store"
  value       = "https://${local.site_domain}"
}

output "admin_url" {
  description = "URL of the admin UI. The CloudFront domain applies until admin_dns_enabled is true."
  value       = var.admin_dns_enabled ? "https://${local.admin_domain}" : "https://${aws_cloudfront_distribution.admin.domain_name}"
}

output "web_bucket_name" {
  description = "S3 bucket that holds the built frontend. The deploy workflow syncs to it."
  value       = aws_s3_bucket.web.bucket
}

output "site_distribution_id" {
  description = "CloudFront distribution ID for the public site. The deploy workflow invalidates it."
  value       = aws_cloudfront_distribution.site.id
}

output "admin_distribution_id" {
  description = "CloudFront distribution ID for the admin UI. The deploy workflow invalidates it."
  value       = aws_cloudfront_distribution.admin.id
}

output "hosted_zone_name_servers" {
  description = "Nameservers to set at the registrar (Namecheap Custom DNS)"
  value       = data.aws_route53_zone.main.name_servers
}

output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = aws_apigatewayv2_api.main.id
}

output "assets_bucket_name" {
  description = "Name of the S3 bucket hosting public product imagery"
  value       = aws_s3_bucket.assets.bucket
}

output "assets_base_url" {
  description = "Public base URL for product imagery; combine with object key to form imageUrl values"
  value       = "https://${aws_s3_bucket.assets.bucket}.s3.${var.aws_region}.amazonaws.com"
}

output "lambda_function_names" {
  description = "Names of the Lambda functions"
  value = {
    get_ingredients           = aws_lambda_function.get_ingredients.function_name
    list_orders               = aws_lambda_function.list_orders.function_name
    create_order              = aws_lambda_function.create_order.function_name
    get_order                 = aws_lambda_function.get_order.function_name
    admin_update_order_status = aws_lambda_function.admin_update_order_status.function_name
    register_robot            = aws_lambda_function.register_robot.function_name
    get_next_order            = aws_lambda_function.get_next_order.function_name
    update_order_status       = aws_lambda_function.update_order_status.function_name
    robot_heartbeat           = aws_lambda_function.robot_heartbeat.function_name
  }
}
