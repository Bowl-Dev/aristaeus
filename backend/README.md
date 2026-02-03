# Aristaeus Backend

AWS Lambda-based serverless backend for the Aristaeus automated bowl kitchen system.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  API Gateway    │────►│  Lambda Functions │────►│  Aurora PostgreSQL │
│  (HTTP API)     │     │  (Node.js 20)     │     │  (Prisma ORM)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Terraform      │
│  (IaC)          │
└─────────────────┘
```

---

## Project Structure

```
backend/
├── src/
│   ├── handlers/              # Lambda function handlers
│   │   ├── ingredients.ts     # GET /api/ingredients
│   │   ├── orders.ts          # Order CRUD operations
│   │   └── robots.ts          # Robot API endpoints
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── response.ts        # API response helpers
│   │   └── nutrition.ts       # Nutritional calculation
│   └── dev-server.ts          # Express server for local dev
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Database seed script
├── infra/                     # Terraform configuration
│   ├── main.tf                # Provider and backend config
│   ├── lambda.tf              # Lambda function definitions
│   ├── api_gateway.tf         # API Gateway routes
│   ├── iam.tf                 # IAM roles and policies
│   ├── variables.tf           # Input variables
│   ├── outputs.tf             # Output values
│   └── backend.tf             # Terraform state backend
├── scripts/
│   └── build-lambda.js        # Lambda packaging script
└── package.json
```

---

## API Endpoints

### User-Facing

| Method | Endpoint           | Handler          | Description                |
| ------ | ------------------ | ---------------- | -------------------------- |
| GET    | `/api/ingredients` | `getIngredients` | List available ingredients |
| POST   | `/api/orders`      | `createOrder`    | Create a new order         |
| GET    | `/api/orders/{id}` | `getOrder`       | Get order details          |

### Admin

| Method | Endpoint                       | Handler                  | Description         |
| ------ | ------------------------------ | ------------------------ | ------------------- |
| GET    | `/api/orders`                  | `listOrders`             | List all orders     |
| PUT    | `/api/orders/{orderId}/status` | `adminUpdateOrderStatus` | Update order status |

### Robot API

| Method | Endpoint                           | Handler             | Description                |
| ------ | ---------------------------------- | ------------------- | -------------------------- |
| POST   | `/api/robots/register`             | `registerRobot`     | Register a new robot       |
| GET    | `/api/robots/{robotId}/next-order` | `getNextOrder`      | Poll for assigned order    |
| POST   | `/api/orders/{orderId}/status`     | `updateOrderStatus` | Robot updates order status |
| POST   | `/api/robots/{robotId}/heartbeat`  | `robotHeartbeat`    | Send heartbeat             |

---

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm 9+

### Setup

```bash
# From the monorepo root
npm install

# Set up environment variables
cp backend/.env.example backend/.env
# Edit .env with your DATABASE_URL

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed the database
npm run db:seed
```

### Running the Dev Server

```bash
# Start Express dev server on port 3000
npm run dev:backend

# Or from the backend directory
cd backend
npm run dev
```

The dev server wraps Lambda handlers in Express routes for local testing.

### Testing Endpoints

```bash
# Get ingredients
curl http://localhost:3000/api/ingredients

# Create an order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "bowlSize": 320,
    "customerName": "Test User",
    "items": [
      {"ingredientId": 1, "quantityGrams": 150},
      {"ingredientId": 5, "quantityGrams": 100}
    ]
  }'

# Get order status
curl http://localhost:3000/api/orders/1

# List all orders (admin)
curl http://localhost:3000/api/orders

# Update order status (admin)
curl -X PUT http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

---

## Database

### Schema Overview

| Table         | Description                              |
| ------------- | ---------------------------------------- |
| `ingredients` | Ingredient catalog with nutritional data |
| `orders`      | Order headers with status and totals     |
| `order_items` | Line items linking orders to ingredients |
| `robots`      | Robot registry for device management     |

### Commands

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Push schema changes to database (dev only)
npm run db:push

# Create a migration
npm run db:migrate

# Deploy migrations (production)
npm run db:migrate:deploy

# Open Prisma Studio GUI
npm run db:studio

# Seed database with sample data
npm run db:seed
```

### Order Status Lifecycle

```
pending → queued → assigned → preparing → ready → completed
                       ↓
                    failed
```

| Status      | Description                              |
| ----------- | ---------------------------------------- |
| `pending`   | Order created, awaiting robot assignment |
| `queued`    | Assigned to robot, waiting for pickup    |
| `assigned`  | Robot has fetched order details          |
| `preparing` | Robot is preparing the bowl              |
| `ready`     | Bowl complete, awaiting pickup           |
| `completed` | Order fulfilled                          |
| `cancelled` | Order cancelled (admin)                  |
| `failed`    | Error during preparation                 |

---

## Deployment

### Prerequisites

- AWS CLI configured
- Terraform installed
- Database provisioned (Aurora Serverless recommended)

### Build Lambda Package

```bash
# Generate Prisma client with Lambda binary
npm run db:generate

# Build Lambda zip
npm run build:backend
# Creates dist/lambda.zip
```

### Deploy with Terraform

```bash
cd backend/infra

# Initialize Terraform
terraform init

# Create terraform.tfvars
cat > terraform.tfvars << EOF
database_url = "postgresql://user:pass@host:5432/aristaeus"
environment = "prod"
cors_allowed_origins = ["https://bowl-dev.github.io"]
EOF

# Plan changes
terraform plan

# Apply infrastructure
terraform apply
```

### Terraform Outputs

After deployment, get the API Gateway URL:

```bash
terraform output api_gateway_url
# https://xxxxxx.execute-api.us-east-1.amazonaws.com
```

---

## Infrastructure

### Lambda Functions

9 Lambda functions are deployed:

- `get_ingredients` - Fetch ingredient catalog
- `create_order` - Create new orders
- `get_order` - Get single order details
- `list_orders` - List all orders (admin)
- `admin_update_order_status` - Admin status updates
- `register_robot` - Robot registration
- `get_next_order` - Robot order polling
- `update_order_status` - Robot status updates
- `robot_heartbeat` - Robot heartbeat

### Environment Variables

| Variable       | Description                  |
| -------------- | ---------------------------- |
| `DATABASE_URL` | PostgreSQL connection string |

### CORS Configuration

Configured in `api_gateway.tf`:

- Allowed origins: Configurable via `cors_allowed_origins` variable
- Allowed methods: GET, POST, PUT, DELETE, OPTIONS
- Allowed headers: Content-Type, Authorization

---

## Scripts

### `npm run dev`

Starts the Express development server with hot reload.

### `npm run build`

Compiles TypeScript and builds Lambda deployment package.

### `npm run build:lambda`

Builds only the Lambda zip package (skips TypeScript compilation).

### `npm run typecheck`

Runs TypeScript compiler without emitting files.

### `npm run lint`

Runs ESLint on source files.

---

## Environment Variables

Create `backend/.env`:

```bash
# Database connection
DATABASE_URL="postgresql://user:password@host:5432/aristaeus"
```

For AWS deployment, set via Terraform variables or AWS Parameter Store.

---

## Dependencies

### Runtime

- `@prisma/client` - Database ORM
- `zod` - Schema validation
- `@aristaeus/shared` - Shared types

### Development

- `express` - Local dev server
- `esbuild` - Lambda bundling
- `tsx` - TypeScript execution
- `prisma` - Database tooling

---

## Troubleshooting

### Lambda Cold Starts

Prisma client is initialized once per Lambda instance. First invocation may be slower.

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check security group allows Lambda access
- Ensure database is running

### CORS Errors

- Verify `cors_allowed_origins` includes your frontend domain
- Check API Gateway CORS configuration in AWS Console

### Prisma Binary Issues

The schema includes `binaryTargets = ["native", "rhel-openssl-3.0.x"]` for Lambda compatibility.
