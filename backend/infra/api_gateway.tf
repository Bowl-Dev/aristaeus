# API Gateway HTTP API for Aristaeus

resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = var.cors_allowed_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization"]
    expose_headers    = []
    max_age           = 300
    allow_credentials = false
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Default stage with auto-deploy
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  # Note: Access logging disabled - requires additional IAM permissions:
  # logs:CreateLogDelivery, logs:DeleteLogDelivery, logs:GetLogDelivery, etc.
  # Add these to the GitHub Actions role to re-enable logging

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-api-${var.environment}"
  retention_in_days = 14

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# ============================================
# Lambda Integrations
# ============================================

resource "aws_apigatewayv2_integration" "get_ingredients" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_ingredients.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "create_order" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.create_order.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "get_order" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_order.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "list_orders" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.list_orders.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "admin_update_order_status" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.admin_update_order_status.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "register_robot" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.register_robot.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "get_next_order" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_next_order.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "update_order_status" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.update_order_status.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "robot_heartbeat" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.robot_heartbeat.invoke_arn
  payload_format_version = "2.0"
}

# ============================================
# Routes
# ============================================

# GET /api/ingredients
resource "aws_apigatewayv2_route" "get_ingredients" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/ingredients"
  target    = "integrations/${aws_apigatewayv2_integration.get_ingredients.id}"
}

# POST /api/orders
resource "aws_apigatewayv2_route" "create_order" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/orders"
  target    = "integrations/${aws_apigatewayv2_integration.create_order.id}"
}

# GET /api/orders (list all - admin)
resource "aws_apigatewayv2_route" "list_orders" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/orders"
  target    = "integrations/${aws_apigatewayv2_integration.list_orders.id}"
}

# GET /api/orders/{id}
resource "aws_apigatewayv2_route" "get_order" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/orders/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.get_order.id}"
}

# PUT /api/orders/{orderId}/status (admin update)
resource "aws_apigatewayv2_route" "admin_update_order_status" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "PUT /api/orders/{orderId}/status"
  target    = "integrations/${aws_apigatewayv2_integration.admin_update_order_status.id}"
}

# POST /api/robots/register
resource "aws_apigatewayv2_route" "register_robot" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/robots/register"
  target    = "integrations/${aws_apigatewayv2_integration.register_robot.id}"
}

# GET /api/robots/{robotId}/next-order
resource "aws_apigatewayv2_route" "get_next_order" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/robots/{robotId}/next-order"
  target    = "integrations/${aws_apigatewayv2_integration.get_next_order.id}"
}

# POST /api/orders/{orderId}/status
resource "aws_apigatewayv2_route" "update_order_status" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/orders/{orderId}/status"
  target    = "integrations/${aws_apigatewayv2_integration.update_order_status.id}"
}

# POST /api/robots/{robotId}/heartbeat
resource "aws_apigatewayv2_route" "robot_heartbeat" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/robots/{robotId}/heartbeat"
  target    = "integrations/${aws_apigatewayv2_integration.robot_heartbeat.id}"
}

# ============================================
# Lambda Permissions for API Gateway
# ============================================

resource "aws_lambda_permission" "get_ingredients" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_ingredients.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "create_order" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_order.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "get_order" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_order.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "list_orders" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.list_orders.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "admin_update_order_status" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.admin_update_order_status.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "register_robot" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.register_robot.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "get_next_order" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_next_order.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "update_order_status" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.update_order_status.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "robot_heartbeat" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.robot_heartbeat.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
