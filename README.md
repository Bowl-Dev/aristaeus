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
- PostgreSQL database (for backend development)

### Installation

```bash
# Clone the repository
git clone https://github.com/bowl-dev/aristaeus.git
cd aristaeus

# Install all dependencies
npm install
```

### Development

```bash
# Start frontend dev server (http://localhost:5173)
npm run dev

# Start backend dev server (http://localhost:3000)
npm run dev:backend

# Both servers can run simultaneously
```

### Environment Setup

**Frontend** (`frontend/.env`):
```bash
VITE_API_URL=http://localhost:3000   # Local development
BASE_PATH=/aristaeus                  # For GitHub Pages
```

**Backend** (`backend/.env`):
```bash
DATABASE_URL="postgresql://user:pass@host:5432/aristaeus"
```

---

## API Endpoints

### User-Facing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ingredients` | Get available ingredients |
| POST | `/api/orders` | Create new order |
| GET | `/api/orders/{id}` | Get order details |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | List all orders |
| PUT | `/api/orders/{orderId}/status` | Update order status |

### Robot API
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/robots/register` | Register new robot |
| GET | `/api/robots/{robotId}/next-order` | Poll for next order |
| POST | `/api/orders/{orderId}/status` | Update order status |
| POST | `/api/robots/{robotId}/heartbeat` | Send heartbeat |

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

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit 2.0, TypeScript, Svelte 5 |
| Backend | AWS Lambda, API Gateway |
| Database | PostgreSQL, Prisma ORM |
| Infrastructure | Terraform |
| CI/CD | GitHub Actions |
| Hosting | GitHub Pages (frontend), AWS (backend) |

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
