# Aristaeus - Automated Bowl Kitchen System

An automated bowl ordering system where users customize bowls through a web interface, orders are stored in a database, and kitchen robots retrieve and fulfill orders.

**Live Demo:** [https://bowl-dev.github.io/aristaeus/](https://bowl-dev.github.io/aristaeus/)

---

## Features

- **Bowl Builder Interface** - Select from 16+ ingredients across 5 categories (proteins, bases, vegetables, toppings, dressings)
- **Real-time Nutritional Tracking** - See calories, protein, carbs, fat, and fiber update as you build
- **Bowl Size Selection** - Choose from 250g, 320g, or 600g bowls with capacity enforcement
- **Order Management** - Submit orders and track status through completion
- **Admin Dashboard** - View all orders and manage their status
- **Robot API** - RESTful endpoints for kitchen robot integration
- **Internationalization** - English and Spanish language support

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

**Frontend:** SvelteKit 2.0 + TypeScript + Svelte 5 runes, deployed to GitHub Pages
**Backend:** AWS Lambda + API Gateway, deployed via Terraform
**Database:** PostgreSQL (Aurora Serverless v2)
**Infrastructure:** Terraform for IaC, GitHub Actions for CI/CD

---

## Project Structure

This is an **npm workspaces monorepo**:

```
aristaeus/
├── frontend/          # @aristaeus/frontend - SvelteKit static site
├── backend/           # @aristaeus/backend - Lambda handlers + Terraform
├── packages/shared/   # @aristaeus/shared - Shared TypeScript types
└── .github/workflows/ # CI/CD pipelines
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Docker (for local database)

### Installation

```bash
git clone https://github.com/bowl-dev/aristaeus.git
cd aristaeus
npm install
```

### Development Modes

Three development configurations are available:

| Mode         | Command                | Description                                 |
| ------------ | ---------------------- | ------------------------------------------- |
| **Local**    | `npm run dev:local`    | Full local stack with Docker PostgreSQL     |
| **Hybrid**   | `npm run dev:hybrid`   | Local backend with hosted Aurora database   |
| **Frontend** | `npm run dev:frontend` | Frontend only, connecting to hosted backend |

### Local Development (Recommended)

Run the entire stack locally using Docker for the database:

```bash
# 1. Start the database
npm run docker:up

# 2. Set up schema and seed data
npm run db:setup

# 3. Start development servers
npm run dev:local
```

This starts:

- Frontend at http://localhost:5173
- Backend at http://localhost:3000
- PostgreSQL at localhost:5432

### Hybrid Development

Use the local backend with the hosted Aurora database (useful for testing against production data):

```bash
# 1. Create config from template
cp backend/.env.hosted.example backend/.env.hosted

# 2. Edit backend/.env.hosted with your Aurora credentials

# 3. Start development
npm run dev:hybrid
```

### Frontend-Only Development

Connect directly to the hosted backend (no local backend needed):

```bash
# 1. Create config from template
cp frontend/.env.hosted.example frontend/.env.hosted

# 2. Edit frontend/.env.hosted with your API Gateway URL

# 3. Start frontend
npm run dev:frontend
```

### Other Commands

```bash
# Database
npm run db:studio              # Open Prisma Studio GUI
npm run docker:reset           # Reset database with fresh data

# Code quality
npm run lint                   # Run ESLint
npm run format                 # Run Prettier
```

---

## API Endpoints

### User-Facing

| Method | Endpoint           | Description               |
| ------ | ------------------ | ------------------------- |
| GET    | `/api/ingredients` | Get available ingredients |
| POST   | `/api/orders`      | Create new order          |
| GET    | `/api/orders/{id}` | Get order details         |

### Admin

| Method | Endpoint                       | Description         |
| ------ | ------------------------------ | ------------------- |
| GET    | `/api/orders`                  | List all orders     |
| PUT    | `/api/orders/{orderId}/status` | Update order status |

### Robot API

| Method | Endpoint                           | Description         |
| ------ | ---------------------------------- | ------------------- |
| POST   | `/api/robots/register`             | Register new robot  |
| GET    | `/api/robots/{robotId}/next-order` | Poll for next order |
| POST   | `/api/orders/{orderId}/status`     | Update order status |
| POST   | `/api/robots/{robotId}/heartbeat`  | Send heartbeat      |

---

## Deployment

### Frontend (GitHub Pages)

Automatic deployment on push to `main` branch via GitHub Actions.

Manual deployment:

```bash
npm run build
# Push to main branch
```

### Backend (AWS via Terraform)

```bash
# Generate Prisma client
npm run db:generate

# Build Lambda package
npm run build:backend

# Deploy infrastructure
cd backend/infra
terraform init
terraform apply
```

---

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - AI assistant reference guide
- **[PROJECT_SPEC.md](./PROJECT_SPEC.md)** - Complete technical specification
- **[frontend/FRONTEND_IMPLEMENTATION.md](./frontend/FRONTEND_IMPLEMENTATION.md)** - Frontend architecture guide

---

## Tech Stack

| Layer          | Technology                             |
| -------------- | -------------------------------------- |
| Frontend       | SvelteKit 2.0, TypeScript, Svelte 5    |
| Backend        | AWS Lambda, API Gateway                |
| Database       | PostgreSQL, Prisma ORM                 |
| Infrastructure | Terraform                              |
| CI/CD          | GitHub Actions                         |
| Hosting        | GitHub Pages (frontend), AWS (backend) |

---

## License

MIT

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
