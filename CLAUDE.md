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
│   SvelteKit         │         │              (Prisma)  Serverless│
│   adapter-static    │         │                                  │
└─────────────────────┘         └──────────────────────────────────┘
```

### Why This Architecture?
- **GitHub Pages**: Free hosting, no domain commitment needed for early development
- **AWS Lambda + API Gateway**: Serverless, pay-per-use, scales automatically
- **Aurora Serverless**: PostgreSQL-compatible, scales to near-zero, Prisma support

---

## Technology Stack

- **Monorepo:** npm workspaces
- **Frontend:** SvelteKit 2.0 + TypeScript + Svelte 5 runes
- **Frontend Deployment:** GitHub Pages (static adapter)
- **Backend:** AWS Lambda + API Gateway (Serverless Framework)
- **ORM:** Prisma
- **Database:** PostgreSQL (Aurora Serverless v2 recommended)
- **Validation:** Zod
- **Shared Types:** `@aristaeus/shared` package

---

## Project Structure

This is an **npm workspaces monorepo**. All commands should be run from the root directory.

```
aristaeus/
├── package.json                       # Root package.json with workspaces config
├── package-lock.json                  # Shared lockfile for all workspaces
├── tsconfig.base.json                 # Shared TypeScript configuration
├── .gitignore                         # Root gitignore
├── CLAUDE.md                          # This file - AI assistant reference
├── PROJECT_SPEC.md                    # Complete technical specification
│
├── frontend/                          # @aristaeus/frontend workspace
│   ├── FRONTEND_IMPLEMENTATION.md     # Frontend architecture & implementation guide
│   ├── README.md                      # SvelteKit project readme
│   ├── package.json                   # Frontend-specific dependencies
│   ├── svelte.config.js               # SvelteKit config (adapter-static)
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
│   ├── serverless.yml                 # Serverless Framework config
│   ├── tsconfig.json                  # Backend TypeScript config
│   ├── prisma/
│   │   ├── schema.prisma              # Database schema
│   │   └── seed.ts                    # Database seed script
│   └── src/
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
        └── deploy-frontend.yml        # GitHub Pages deployment
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

### ✅ Completed
- Monorepo structure with npm workspaces
- Frontend bowl builder page with ingredient selection
- Ingredient mock data (16 ingredients across 5 categories)
- Basic nutritional calculation logic
- Customer name input
- UI styling (responsive design)
- **Backend Lambda handlers** (ingredients, orders, robots)
- **Prisma database schema**
- **Serverless Framework configuration**
- **GitHub Pages deployment workflow**
- **Static adapter configuration**

### 🚧 In Progress / Needs Work
- Bowl size selection (250g, 320g, 480g) with capacity enforcement
- Real-time nutritional summary updates
- Component architecture (needs refactoring per FRONTEND_IMPLEMENTATION.md)
- Connect frontend to backend API

### 📋 Not Started
- AWS deployment (Lambda, API Gateway, Aurora)
- Database provisioning
- Robot abstraction layer testing
- Authentication (out of scope for MVP)
- Payment processing (out of scope for MVP)

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
- Prisma schema: `backend/prisma/schema.prisma`
- Database seed: `backend/prisma/seed.ts`
- Serverless config: `backend/serverless.yml`
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
- Serverless config: `backend/serverless.yml`

---

## Common Development Tasks

### Initial Setup
```bash
npm install                    # Install all workspace dependencies
```

### Running Development Servers
```bash
# Frontend (http://localhost:5173)
npm run dev

# Backend API (http://localhost:3000)
npm run dev:backend
```

### Database Operations
```bash
npm run db:generate            # Generate Prisma client
npm run db:push                # Push schema to database
npm run db:migrate             # Create migration
npm run db:seed                # Seed database with sample data
npm run db:studio              # Open Prisma Studio GUI
```

### Building & Deployment
```bash
# Frontend build (for GitHub Pages)
npm run build

# Deploy backend to AWS
npm run deploy:backend         # Deploy to dev stage
npm run deploy:backend:prod    # Deploy to production
```

### Environment Setup

**Backend** (`backend/.env`):
```bash
DATABASE_URL="postgresql://user:pass@host:5432/aristaeus"
```

**Frontend** (`frontend/.env`):
```bash
VITE_API_URL=http://localhost:3000   # Local development
# VITE_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com  # Production
BASE_PATH=/aristaeus                  # For GitHub Pages (repo name)
```

---

## API Endpoints Quick Reference

### User-Facing
- `GET /api/ingredients` - Get available ingredients
- `POST /api/orders` - Create new order
- `GET /api/orders/{id}` - Get order status

### Robot-Facing
- `POST /api/robots/register` - Register new robot
- `GET /api/robots/{robotId}/next-order` - Poll for next order
- `POST /api/orders/{orderId}/status` - Update order status
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

### AWS (Backend)

1. **Prerequisites:**
   - AWS CLI configured
   - Serverless Framework installed (`npm i -g serverless`)
   - Aurora Serverless database provisioned

2. **Deploy:**
   ```bash
   # Set DATABASE_URL environment variable
   export DATABASE_URL="postgresql://..."

   # Generate Prisma client
   npm run db:generate

   # Deploy to AWS
   npm run deploy:backend
   ```

3. **Update frontend:**
   - Set `VITE_API_URL` to API Gateway URL
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

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-02 | 1.0 | Initial CLAUDE.md creation |
| 2025-12-14 | 1.1 | Converted to npm workspaces monorepo, added `@aristaeus/shared` package |
| 2025-12-14 | 2.0 | Added serverless backend (Lambda + Prisma), GitHub Pages deployment |

---

**Last Updated:** 2025-12-14
**Project Status:** MVP Development
**Current Phase:** Backend Implementation + Frontend Static Deployment
