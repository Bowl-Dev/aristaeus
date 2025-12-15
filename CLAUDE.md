# Aristaeus - Automated Bowl Kitchen System

**AI Assistant Reference Guide**

This document provides an overview of the Aristaeus project for AI assistants working on the codebase.

---

## Project Overview

Aristaeus is an automated bowl ordering system where users customize bowls through a web interface, orders are stored in a database, and kitchen robots (ESP32-based) retrieve and fulfill orders. The MVP focuses on order capture and data management with device communication abstraction for future robot integration.

---

## Technology Stack

- **Monorepo:** npm workspaces
- **Frontend:** SvelteKit 2.0 + TypeScript
- **Backend:** SvelteKit API routes (Node.js)
- **Database:** PostgreSQL (currently mocked for development)
- **Deployment:** AWS (TBD)
- **Device Communication:** Abstracted for future ESP32 integration
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
│   ├── src/
│   │   ├── routes/
│   │   │   ├── +page.svelte          # Main bowl builder interface
│   │   │   ├── +layout.svelte        # Layout wrapper
│   │   │   └── (future: api/, order/ routes)
│   │   ├── lib/
│   │   │   ├── assets/               # Static assets
│   │   │   └── index.ts
│   │   └── app.d.ts
│   ├── static/
│   ├── svelte.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
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
└── (future: backend/, database/, robots/)
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
- Sample data and seed scripts

**When to consult:** System architecture, database design, API contracts, business rules

---

### 2. [frontend/FRONTEND_IMPLEMENTATION.md](./frontend/FRONTEND_IMPLEMENTATION.md)
**Detailed frontend implementation guide.**

- TypeScript type definitions
- Component specifications (IngredientSelector, NutritionalDisplay, OrderSummary)
- State management patterns (Svelte stores)
- Nutritional calculation logic (client-side)
- Page implementations
- API route implementations
- Styling guidelines
- Validation rules

**When to consult:** Frontend development, component structure, client-side logic

---

### 3. [frontend/README.md](./frontend/README.md)
**SvelteKit project documentation.**

- Development server setup
- Build commands
- Deployment information

**When to consult:** Running the project, build processes

---

## Current Implementation Status

### ✅ Completed
- Basic project structure (SvelteKit)
- Main bowl builder page with ingredient selection
- Ingredient mock data (17 ingredients across 5 categories)
- Basic nutritional calculation logic
- Customer name input
- UI styling (responsive design)

### 🚧 In Progress / Needs Work
- **Bowl size selection** (250g, 320g, 480g) with capacity enforcement
- **Real-time nutritional summary updates** (currently has bugs)
- **Card-based ingredient UI** (currently list-based)
- Component architecture (needs refactoring per FRONTEND_IMPLEMENTATION.md)
- State management (needs Svelte stores implementation)
- API routes (currently mocked)
- Order status page
- Admin orders view (`/admin/orders`)

### 📋 Not Started
- Database integration (PostgreSQL)
- Backend API implementation
- Robot abstraction layer
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
- **Minimum quantity:** 10g per ingredient (from PROJECT_SPEC.md:789)
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

## Important Notes for AI Assistants

### Nutritional Data Source
- **Current:** Mocked data in `+page.svelte` (lines 33-60)
- **Future:** Will be fetched from database via `/api/ingredients`
- **Important:** Nutritional values tied to ingredient availability (same DB source)

### What NOT to Implement (Out of Scope)
- User authentication/accounts
- Payment processing
- Inventory/stock management
- Order modifications/cancellations
- Allergen tracking
- Multi-bowl orders
- Pricing logic (for now - will be based on bowl size later)

### Temporary/Testing Features
- `/admin/orders` route - temporary testing interface, DO NOT document in specs
- Mock data - will be replaced with database queries
- Console logs for order submission - will be replaced with API calls

### Code Style & Patterns
- **TypeScript:** Strict typing, use interfaces from FRONTEND_IMPLEMENTATION.md
- **Svelte 5:** Use runes (`$state`, `$derived`, `$effect`) - already in use
- **State Management:** Implement Svelte stores per FRONTEND_IMPLEMENTATION.md
- **Reactivity:** Leverage Svelte's reactive system, avoid manual DOM manipulation
- **Component Structure:** Follow single-responsibility principle

---

## Quick Reference: File Locations

### Specifications
- Overall system spec: `PROJECT_SPEC.md`
- Frontend implementation guide: `frontend/FRONTEND_IMPLEMENTATION.md`
- Frontend readme: `frontend/README.md`

### Shared Package (`@aristaeus/shared`)
- Types: `packages/shared/src/types/index.ts`
- Main exports: `packages/shared/src/index.ts`

### Frontend Code (`@aristaeus/frontend`)
- Main bowl builder: `frontend/src/routes/+page.svelte`
- Layout: `frontend/src/routes/+layout.svelte`
- Stores: Will be at `frontend/src/lib/stores/bowl.ts` (not yet created)
- Utils: Will be at `frontend/src/lib/utils/nutrition.ts` (not yet created)
- Components: Will be at `frontend/src/lib/components/` (not yet created)

### Configuration
- Root package.json: `package.json` (workspaces config)
- Root TypeScript: `tsconfig.base.json` (shared TS config)
- Frontend package: `frontend/package.json`
- Frontend TypeScript: `frontend/tsconfig.json`
- Svelte config: `frontend/svelte.config.js`
- Vite config: `frontend/vite.config.ts`

---

## Common Development Tasks

### Initial Setup (from root directory)
```bash
npm install    # Installs all workspace dependencies
```

### Running the Development Server
```bash
npm run dev    # Runs frontend dev server
```
Access at: `http://localhost:5173`

### Building for Production
```bash
npm run build      # Build frontend
npm run preview    # Preview production build
```

### Running TypeScript Checks
```bash
npm run check      # Run svelte-check on frontend
```

### Working with Specific Workspaces
```bash
# Run any script in a specific workspace
npm run <script> --workspace=frontend
npm run <script> --workspace=@aristaeus/shared

# Install a dependency to a specific workspace
npm install <package> --workspace=frontend
```

### Adding New Ingredients (Mock Data)
Edit `frontend/src/routes/+page.svelte` lines 33-60

### Modifying Nutritional Calculation
Current location: `frontend/src/routes/+page.svelte` lines 79-103
Future location: `frontend/src/lib/utils/nutrition.ts`

### Using Shared Types in Frontend
```typescript
import type { Ingredient, BowlSize, NutritionalSummary } from '@aristaeus/shared';
```

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
id, status,
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

Full schema: See PROJECT_SPEC.md lines 94-176

---

## API Endpoints Quick Reference

### User-Facing
- `GET /api/ingredients` - Get available ingredients
- `POST /api/orders` - Create new order
- `GET /api/orders/{id}` - Get order status

### Robot-Facing (Future)
- `POST /api/robots/register` - Register new robot
- `GET /api/robots/{id}/next-order` - Poll for next order
- `POST /api/orders/{id}/status` - Update order status
- `POST /api/robots/{id}/heartbeat` - Send heartbeat

Full API spec: See PROJECT_SPEC.md lines 223-430

---

## Known Issues & TODOs

### Critical Bugs
1. **Nutritional summary not updating in real-time** - Reactivity issue in `+page.svelte`

### High Priority Features
1. **Bowl size selection** - Add 250g/320g/480g size picker
2. **Capacity enforcement** - Prevent exceeding selected bowl size
3. **Card-based ingredient UI** - Replace list with card-based selection
4. **Component refactoring** - Extract components per FRONTEND_IMPLEMENTATION.md
5. **Admin orders view** - Create `/admin/orders` route for testing

### Medium Priority
1. **API routes implementation** - Create SvelteKit API routes
2. **Order status page** - Create `/order/[id]` route
3. **State management** - Implement Svelte stores
4. **Form validation** - Add client-side validation with error messages

### Low Priority / Future
1. **Database integration** - Connect to PostgreSQL
2. **Robot API implementation** - Implement robot-facing endpoints
3. **Order assignment algorithm** - Implement robot assignment logic

---

## Contact & Questions

For implementation questions:
1. First consult the relevant specification document
2. Check this CLAUDE.md for quick references
3. Review existing code in `frontend/src/`
4. Refer to [SvelteKit documentation](https://kit.svelte.dev/docs) for framework questions

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-02 | 1.0 | Initial CLAUDE.md creation |
| 2025-12-14 | 1.1 | Converted to npm workspaces monorepo, added `@aristaeus/shared` package |

---

**Last Updated:** 2025-12-14
**Project Status:** Early MVP Development
**Current Phase:** Frontend Implementation with Mock Data
