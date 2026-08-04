# Variables for Aristaeus Backend Infrastructure

variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "aristaeus"
}

variable "database_url" {
  description = "PostgreSQL database connection URL"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Root domain for this environment (prod: algramo.app, dev: dev.algramo.app)"
  type        = string
  default     = "algramo.app"
}

variable "hosted_zone_name" {
  description = "Route 53 zone that holds the records. All environments share one zone."
  type        = string
  default     = "algramo.app"
}

variable "admin_dns_enabled" {
  description = "Create the admin.<domain> record and attach the certificate to the admin distribution. Keep false until the admin API has authentication."
  type        = bool
  default     = false
}

variable "cors_allowed_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default = [
    "http://localhost:5173",
    "https://bowl-dev.github.io"
  ]
}
