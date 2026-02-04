# Aristaeus - Automated Bowl Kitchen System

**AI Assistant Reference Guide**

This document provides an overview of the Aristaeus project for AI assistants working on the codebase.

---

## Project Overview

Aristaeus is an automated bowl ordering system where users customize bowls through a web interface, orders are stored in a database, and kitchen robots (ESP32-based) retrieve and fulfill orders. The MVP focuses on order capture and data management with device communication abstraction for future robot integration.

---

## Architecture

```
┌─────────────────────┐         ┌──────────────────────────────────┐
│   GitHub Pages      │         │           AWS                    │
│   (Static Frontend) │  HTTPS  │                                  │
│                     │ ──────► │  API Gateway → Lambda → Aurora   │
│   SvelteKit         │         │              (Prisma)            │
│   adapter-static    │         │         (Terraform)              │
└─────────────────────┘         └──────────────────────────────────┘
```

### Why This Architecture?

- **GitHub Pages**: Free hosting, no domain commitment needed for early development
- **AWS Lambda + API Gateway**: Serverless, pay-per-use, scales automatically
- **Terraform**: Infrastructure as code for AWS deployments
- **Aurora Serverless**: PostgreSQL-compatible, scales to near-zero, Prisma support

---

## Technology Stack

- **Monorepo:** npm workspaces
- **Frontend:** SvelteKit 2.0 + TypeScript + Svelte 5 runes
- **Frontend Deployment:** GitHub Pages (static adapter)
- **Backend:** AWS Lambda + API Gateway (deployed via Terraform)
- **Infrastructure:** Terraform
- **Local Development:** Express dev server wrapping Lambda handlers
- **ORM:** Prisma
- **Database:** PostgreSQL (Aurora Serverless v2 recommended)
- **Validation:** Zod
- **Shared Types:** `@aristaeus/shared` package
- **Linting:** ESLint + Prettier with Husky pre-commit hooks

---

## Project Structure

This is an **npm workspaces monorepo**. All commands should be run from the root directory.

```
aristaeus/
├── package.json                       # Root package.json with workspaces config
├── package-lock.json                  # Shared lockfile for all workspaces
├── docker-compose.yml                 # Local PostgreSQL database
├── tsconfig.base.json                 # Shared TypeScript configuration
├── eslint.config.js                   # ESLint flat config
├── .prettierrc                        # Prettier configuration
├── .prettierignore                    # Prettier ignore patterns
├── .husky/                            # Husky pre-commit hooks
├── .gitignore                         # Root gitignore
├── CLAUDE.md                          # This file - AI assistant reference
├── PROJECT_SPEC.md                    # Complete technical specification
│
├── frontend/                          # @aristaeus/frontend workspace
│   ├── FRONTEND_IMPLEMENTATION.md     # Frontend architecture & implementation guide
│   ├── README.md                      # SvelteKit project readme
│   ├── package.json                   # Frontend-specific dependencies
│   ├── svelte.config.js               # SvelteKit config (adapter-static)
│   ├── .env.local                     # Local backend URL (committed)
│   ├── .env.hosted.example            # Template for hosted backend URL
│   ├── src/
│   │   ├── routes/
│   │   │   ├── +page.svelte           # Main bowl builder interface
│   │   │   ├── +layout.svelte         # Layout wrapper
│   │   │   ├── +layout.ts             # Static rendering config
│   │   │   └── admin/orders/          # Testing interface
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   └── client.ts          # API client for AWS backend
│   │   │   ├── components/            # Svelte components
│   │   │   ├── types/                 # Frontend-specific types
│   │   │   └── i18n/                  # Internationalization
│   │   └── app.d.ts
│   └── static/
│
├── backend/                           # @aristaeus/backend workspace
│   ├── package.json                   # Backend dependencies
│   ├── tsconfig.json                  # Backend TypeScript config
│   ├── .env.local                     # Docker PostgreSQL connection (committed)
│   ├── .env.hosted.example            # Template for Aurora credentials
│   ├── prisma/
│   │   ├── schema.prisma              # Database schema
│   │   └── seed.ts                    # Database seed script
│   ├── infra/                         # Terraform infrastructure
│   │   ├── main.tf                    # Main Terraform config
│   │   ├── lambda.tf                  # Lambda function definitions
│   │   ├── api_gateway.tf             # API Gateway configuration
│   │   ├── iam.tf                     # IAM roles and policies
│   │   ├── variables.tf               # Terraform variables
│   │   ├── outputs.tf                 # Terraform outputs
│   │   └── backend.tf                 # Terraform backend config
│   ├── scripts/
│   │   └── build-lambda.js            # Lambda build script
│   └── src/
│       ├── dev-server.ts              # Express dev server for local development
│       ├── handlers/
│       │   ├── ingredients.ts         # GET /api/ingredients
│       │   ├── orders.ts              # Order CRUD handlers
│       │   └── robots.ts              # Robot API handlers
│       └── lib/
│           ├── db.ts                  # Prisma client singleton
│           ├── response.ts            # API response helpers
│           └── nutrition.ts           # Server-side nutrition calc
│
├── packages/
│   └── shared/                        # @aristaeus/shared workspace
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts               # Main exports
│           └── types/
│               └── index.ts           # Shared TypeScript types
│
└── .github/
    └── workflows/
        ├── lint.yml                   # Linting & formatting checks
        ├── deploy-frontend.yml        # GitHub Pages deployment
        └── deploy-backend.yml         # Backend deployment via Terraform
```

---

## Key Specification Documents

### 1. [PROJECT_SPEC.md](./PROJECT_SPEC.md)

**The source of truth for the entire system.**

- Complete database schema (ingredients, orders, order_items, robots)
- API specifications (user-facing & robot-facing)
- Business logic and order lifecycle
- Nutritional calculation requirements
- Security considerations
- Deployment architecture

**When to consult:** System architecture, database design, API contracts, business rules

---

### 2. [frontend/FRONTEND_IMPLEMENTATION.md](./frontend/FRONTEND_IMPLEMENTATION.md)

**Detailed frontend implementation guide.**

- TypeScript type definitions
- Component specifications
- State management patterns (Svelte 5 runes)
- Nutritional calculation logic (client-side)
- Styling guidelines
- Validation rules

**When to consult:** Frontend development, component structure, client-side logic

---

## Current Implementation Status

### ✅ Completed (MVP Functional)

- Monorepo structure with npm workspaces
- **Frontend bowl builder** - fully functional with API integration
  - Ingredient selection from database
  - Bowl size selection (250g, 320g, 600g) with capacity enforcement
  - Real-time nutritional summary calculation
  - Customer name input
  - Order submission to backend API
  - Loading, error, and success states
  - Internationalization (English/Spanish)
- **Admin orders page** (`/admin/orders`)
  - View all orders from database
  - Update order status via dropdown
  - Real-time refresh functionality
- **Backend Lambda handlers** (fully deployed to AWS)
  - `GET /api/ingredients` - fetch available ingredients
  - `GET /api/orders` - list all orders (admin)
  - `POST /api/orders` - create new order
  - `GET /api/orders/{id}` - get order details
  - `PUT /api/orders/{orderId}/status` - admin status update
  - `POST /api/orders/{orderId}/status` - robot status update
  - Robot registration, heartbeat, and next-order endpoints
- **Prisma database schema** with PostgreSQL
- **Terraform infrastructure** for AWS deployment
- **CI/CD Pipelines**
  - GitHub Actions for frontend deployment to GitHub Pages
  - GitHub Actions for backend deployment via Terraform
- **Express dev server** for local development

### 📋 Not Started (Out of Scope for MVP)

- Robot abstraction layer testing with actual ESP32 devices
- User authentication/accounts
- Payment processing
- Inventory/stock management
- Order modifications/cancellations
- Allergen tracking
- Multi-bowl orders
- Pricing logic

---

## Key Business Rules

### Nutritional Calculation

- **Client-side:** Real-time calculation as user builds bowl
- **Server-side:** Must recalculate and validate on order submission (prevent tampering)
- **Formula:** `(ingredient_value_per_100g * quantity_grams) / 100`
- **Critical:** Client and server calculations MUST match exactly

### Bowl Size Constraints

- **Fixed bowl sizes:** 250g, 320g, 480g
- **User selection:** Must choose a bowl size before/during bowl building
- **Capacity enforcement:** Total ingredient weight cannot exceed selected bowl size
- **UI feedback:** Show remaining capacity, prevent exceeding limit

### Ingredient Selection

- **Minimum quantity:** 10g per ingredient
- **Categories:** protein, base, vegetable, topping, dressing
- **Availability:** Only show ingredients where `available = true`
- **Sequence order:** Ingredients have assembly order for robot execution

### Order Status Lifecycle

```
pending → queued → assigned → preparing → ready → completed
                        ↓
                     failed
```

---

## Quick Reference: File Locations

### Backend Code (`@aristaeus/backend`)

- Lambda handlers: `backend/src/handlers/`
- Dev server: `backend/src/dev-server.ts`
- Prisma schema: `backend/prisma/schema.prisma`
- Database seed: `backend/prisma/seed.ts`
- Terraform infra: `backend/infra/`
- Utilities: `backend/src/lib/`

### Frontend Code (`@aristaeus/frontend`)

- Main bowl builder: `frontend/src/routes/+page.svelte`
- API client: `frontend/src/lib/api/client.ts`
- Components: `frontend/src/lib/components/`
- Static config: `frontend/src/routes/+layout.ts`

### Shared Package (`@aristaeus/shared`)

- Types: `packages/shared/src/types/index.ts`
- Main exports: `packages/shared/src/index.ts`

### Configuration

- Root package.json: `package.json` (workspaces config)
- Svelte config: `frontend/svelte.config.js` (adapter-static)
- Terraform config: `backend/infra/*.tf`

---

## Common Development Tasks

### Initial Setup

```bash
npm install                    # Install all workspace dependencies
```

### Development Modes

Three development configurations are available:

| Mode              | Command                | Frontend       | Backend        | Database          |
| ----------------- | ---------------------- | -------------- | -------------- | ----------------- |
| **Local**         | `npm run dev:local`    | localhost:5173 | localhost:3000 | Docker PostgreSQL |
| **Hybrid**        | `npm run dev:hybrid`   | localhost:5173 | localhost:3000 | AWS Aurora        |
| **Frontend-only** | `npm run dev:frontend` | localhost:5173 | AWS Lambda     | AWS Aurora        |

```bash
# Full local development (Docker DB required)
npm run dev:local

# Local backend with hosted database
npm run dev:hybrid

# Frontend only, connecting to production backend
npm run dev:frontend
```

#### First-time Local Setup

```bash
npm run docker:up              # Start Docker PostgreSQL
npm run db:setup               # Push schema and seed data
npm run dev:local              # Run local development
```

#### Using Hosted Database

```bash
# Create .env.hosted files from templates
cp backend/.env.hosted.example backend/.env.hosted
cp frontend/.env.hosted.example frontend/.env.hosted

# Edit with your credentials, then run:
npm run dev:hybrid             # Local backend + hosted DB
npm run dev:frontend           # Hosted backend + hosted DB
```

### Linting & Formatting

```bash
npm run lint                   # Run ESLint on all files
npm run lint:fix               # Run ESLint and auto-fix issues
npm run format                 # Format all files with Prettier
npm run format:check           # Check formatting without modifying
```

**Pre-commit hooks:** Husky automatically runs lint-staged on commit, which:

- Runs ESLint with auto-fix on staged `.js`, `.ts`, `.svelte` files
- Formats staged files with Prettier

### Database Operations

```bash
npm run db:generate            # Generate Prisma client
npm run db:push                # Push schema to database
npm run db:seed                # Seed database with sample data
npm run db:studio              # Open Prisma Studio GUI
npm run db:setup               # Push schema + seed (shortcut)
```

### Building & Deployment

```bash
# Frontend build (for GitHub Pages)
npm run build

# Build Lambda package for AWS deployment
npm run build:backend          # Creates dist/lambda.zip

# Deploy backend to AWS (via Terraform)
cd backend/infra
terraform init
terraform apply
```

### Environment Setup

Environment files are managed by npm scripts. Use development modes instead of editing `.env` directly:

| File                   | Purpose                      | Committed                              |
| ---------------------- | ---------------------------- | -------------------------------------- |
| `backend/.env.local`   | Docker PostgreSQL connection | Yes                                    |
| `backend/.env.hosted`  | Aurora credentials           | No (create from `.env.hosted.example`) |
| `frontend/.env.local`  | Local backend URL            | Yes                                    |
| `frontend/.env.hosted` | AWS API Gateway URL          | No (create from `.env.hosted.example`) |

The `.env` files are auto-generated when running `npm run dev:local`, `dev:hybrid`, or `dev:frontend`.

---

## API Endpoints Quick Reference

### User-Facing

- `GET /api/ingredients` - Get available ingredients
- `POST /api/orders` - Create new order
- `GET /api/orders/{id}` - Get order status

### Admin

- `GET /api/orders` - List all orders (admin view)
- `PUT /api/orders/{orderId}/status` - Update order status (admin)

### Robot-Facing

- `POST /api/robots/register` - Register new robot
- `GET /api/robots/{robotId}/next-order` - Poll for next order
- `POST /api/orders/{orderId}/status` - Update order status (robot)
- `POST /api/robots/{robotId}/heartbeat` - Send heartbeat

Full API spec: See PROJECT_SPEC.md

---

## Database Schema Quick Reference

### Ingredients Table

```sql
id, name, category,
calories_per_100g, protein_g_per_100g, carbs_g_per_100g,
fat_g_per_100g, fiber_g_per_100g,
available, display_order
```

### Orders Table

```sql
id, bowl_size, customer_name, status,
total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, total_weight_g,
assigned_robot_id,
created_at, assigned_at, started_at, completed_at
```

### Order Items Table

```sql
id, order_id, ingredient_id,
quantity_grams, sequence_order
```

### Robots Table

```sql
id, name, identifier, status,
current_order_id, last_heartbeat
```

Full schema: See `backend/prisma/schema.prisma`

---

## Deployment Guide

### GitHub Pages (Frontend)

1. **Automatic:** Push to `main` branch triggers GitHub Actions workflow
2. **Manual:**

   ```bash
   cd frontend
   npm run deploy:gh-pages
   ```

3. **GitHub Settings:**
   - Go to repo Settings → Pages
   - Source: GitHub Actions
   - Set `VITE_API_URL` in repo variables

### AWS (Backend via Terraform)

1. **Prerequisites:**
   - AWS CLI configured with appropriate credentials
   - Terraform installed (`brew install terraform` or download from terraform.io)
   - Aurora Serverless database provisioned

2. **Build Lambda package:**

   ```bash
   # Generate Prisma client
   npm run db:generate

   # Build Lambda zip
   npm run build:backend
   ```

3. **Deploy with Terraform:**

   ```bash
   cd backend/infra

   # Initialize Terraform
   terraform init

   # Create terraform.tfvars with your values
   echo 'database_url = "postgresql://user:pass@host:5432/aristaeus"' > terraform.tfvars

   # Plan and review changes
   terraform plan

   # Apply infrastructure
   terraform apply
   ```

4. **Update frontend:**
   - Get API Gateway URL from Terraform output: `terraform output api_gateway_url`
   - Set `VITE_API_URL` to the API Gateway URL
   - Rebuild and deploy frontend

---

## Important Notes for AI Assistants

### What NOT to Implement (Out of Scope)

- User authentication/accounts
- Payment processing
- Inventory/stock management
- Order modifications/cancellations
- Allergen tracking
- Multi-bowl orders
- Pricing logic (for now)

### Code Style & Patterns

- **TypeScript:** Strict typing everywhere
- **Svelte 5:** Use runes (`$state`, `$derived`, `$effect`)
- **Backend:** Zod for validation, Prisma for database
- **API:** Return JSON, use standard HTTP status codes
- **Linting:** All code must pass ESLint and Prettier checks before commit
- **Formatting:** Uses tabs, single quotes, no trailing commas (see `.prettierrc`)

### Testing the Backend Locally

```bash
# Terminal 1: Start backend
npm run dev:backend

# Terminal 2: Test endpoints
curl http://localhost:3000/api/ingredients
curl -X POST http://localhost:3000/api/orders -H "Content-Type: application/json" -d '{"bowlSize":320,"items":[{"ingredientId":1,"quantityGrams":100}]}'
```

---

## Version History

| Date       | Version | Changes                                                                                     |
| ---------- | ------- | ------------------------------------------------------------------------------------------- |
| 2025-12-02 | 1.0     | Initial CLAUDE.md creation                                                                  |
| 2025-12-14 | 1.1     | Converted to npm workspaces monorepo, added `@aristaeus/shared` package                     |
| 2025-12-14 | 2.0     | Added serverless backend (Lambda + Prisma), GitHub Pages deployment                         |
| 2025-12-15 | 2.1     | Migrated from Serverless Framework to Terraform, added Express dev server                   |
| 2026-01-09 | 3.0     | **MVP Complete** - Connected frontend to backend, admin orders page, all endpoints deployed |
| 2026-02-03 | 3.1     | Added ESLint + Prettier linting, Husky pre-commit hooks, CI lint checks                     |

---

**Last Updated:** 2026-02-03
**Project Status:** MVP Complete
**Current Phase:** Production Ready (Robot integration pending)
