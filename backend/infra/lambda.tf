# Lambda Functions for Aristaeus API

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = toset([
    "getIngredients",
    "createOrder",
    "getOrder",
    "registerRobot",
    "getNextOrder",
    "updateOrderStatus",
    "robotHeartbeat"
  ])

  name              = "/aws/lambda/${var.project_name}-${each.key}-${var.environment}"
  retention_in_days = 14

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Lambda Functions
resource "aws_lambda_function" "get_ingredients" {
  function_name = "${var.project_name}-getIngredients-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handlers/ingredients.getIngredients"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/../dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/lambda.zip")

  environment {
    variables = {
      DATABASE_URL = var.database_url
      NODE_ENV     = var.environment
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_lambda_function" "create_order" {
  function_name = "${var.project_name}-createOrder-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handlers/orders.createOrder"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/../dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/lambda.zip")

  environment {
    variables = {
      DATABASE_URL = var.database_url
      NODE_ENV     = var.environment
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_lambda_function" "get_order" {
  function_name = "${var.project_name}-getOrder-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handlers/orders.getOrder"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/../dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/lambda.zip")

  environment {
    variables = {
      DATABASE_URL = var.database_url
      NODE_ENV     = var.environment
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_lambda_function" "register_robot" {
  function_name = "${var.project_name}-registerRobot-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handlers/robots.registerRobot"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/../dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/lambda.zip")

  environment {
    variables = {
      DATABASE_URL = var.database_url
      NODE_ENV     = var.environment
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_lambda_function" "get_next_order" {
  function_name = "${var.project_name}-getNextOrder-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handlers/robots.getNextOrder"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/../dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/lambda.zip")

  environment {
    variables = {
      DATABASE_URL = var.database_url
      NODE_ENV     = var.environment
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_lambda_function" "update_order_status" {
  function_name = "${var.project_name}-updateOrderStatus-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handlers/orders.updateOrderStatus"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/../dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/lambda.zip")

  environment {
    variables = {
      DATABASE_URL = var.database_url
      NODE_ENV     = var.environment
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_lambda_function" "robot_heartbeat" {
  function_name = "${var.project_name}-robotHeartbeat-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handlers/robots.heartbeat"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/../dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/lambda.zip")

  environment {
    variables = {
      DATABASE_URL = var.database_url
      NODE_ENV     = var.environment
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
