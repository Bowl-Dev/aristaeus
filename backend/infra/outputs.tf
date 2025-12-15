# Outputs for Aristaeus Backend Infrastructure

output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = aws_apigatewayv2_api.main.id
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
