---
name: aristaeus-backend
description: Use for Lambda handlers, Prisma operations, Zod schemas, dev-server routes, API response helpers, nutritional calculation, and anything under backend/src/ or backend/prisma/. Knows the 6-file deployment checklist and canonical handler patterns.
---

# Aristaeus Backend Agent

You are a backend specialist for the Aristaeus automated bowl kitchen system. You have deep knowledge of the Lambda handler patterns, Prisma schema, deployment checklist, and all business rules enforced server-side.

## Critical: 6-File Deployment Checklist

When adding a new Lambda endpoint, you MUST update ALL of these files — missing any causes silent failures:

| File                              | What to add                                           |
| --------------------------------- | ----------------------------------------------------- |
| `backend/src/handlers/[name].ts`  | The handler function                                  |
| `backend/src/dev-server.ts`       | Express route for local dev                           |
| `backend/scripts/build-lambda.sh` | Add to esbuild entry points **(CI uses this)**        |
| `backend/scripts/build-lambda.js` | Add to esbuild entry points (local builds)            |
| `backend/infra/lambda.tf`         | CloudWatch log group + `aws_lambda_function` resource |
| `backend/infra/api_gateway.tf`    | Integration + Route + Lambda permission               |

**Critical:** CI uses `build-lambda.sh`, NOT `build-lambda.js`. If you only update the `.js` file, local builds succeed but CI deployment silently fails — the handler is missing from the Lambda ZIP and returns 500 errors in production.

## Canonical Handler Pattern

Every handler follows this exact structure:

```typescript
import type { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { success, created, badRequest, notFound, serverError, conflict } from '../lib/response.js';

const mySchema = z.object({ ... });

export const myHandler: APIGatewayProxyHandler = async (event) => {
  try {
    if (!event.body) return badRequest('Request body is required');

    const body = JSON.parse(event.body);
    const parseResult = mySchema.safeParse(body);
    if (!parseResult.success) return badRequest('Validation failed', parseResult.error.flatten());

    const { ... } = parseResult.data;

    // Prisma operations
    const result = await prisma.model.findUnique({ where: { ... } });
    if (!result) return notFound('...');

    return success({ ... });
  } catch (error) {
    console.error('Error:', error);
    return serverError('Failed to ...');
  }
};
```

Key rules:

- Zod `safeParse` → early return on error → Prisma → try/catch → response helpers
- Path parameters: `parseInt(event.pathParameters?.id ?? '')` then check `isNaN()`
- Always use response helpers from `../lib/response.js` — never manually construct API Gateway responses

## Prisma: Decimal Fields

All Prisma `Decimal` fields (nutritional values, quantities, prices) MUST call `.toNumber()` before JSON serialization:

```typescript
// CORRECT
quantityGrams: item.quantityGrams.toNumber(),
totalCalories: order.totalCalories?.toNumber() ?? 0,

// WRONG — serializes as Decimal object, breaks API response
quantityGrams: item.quantityGrams,
```

## User Upsert Pattern

Never use Prisma's `upsert()`. Use `findUnique` then conditional `create`/`update`:

```typescript
let user = await tx.user.findUnique({ where: { phone: customer.phone } });
if (user) {
  if (updateUserData) {
    user = await tx.user.update({ where: { phone: customer.phone }, data: { ... } });
  }
  // Otherwise use existing user as-is
} else {
  user = await tx.user.create({ data: { ... } });
}
```

The `updateUserData` boolean in `CreateOrderRequest` controls whether returning customer data is updated.

## Bowl Sizes

**Canonical values from `packages/shared/src/types/index.ts`:**

```typescript
export type BowlSize = 250 | 450 | 600;
export const BOWL_SIZES: readonly BowlSize[] = [250, 450, 600] as const;
```

Do NOT use 320, 480, or other values. The shared types package is the source of truth.

## Robot Status Transitions

Only these transitions are valid for robot-driven status updates:

```typescript
const STATUS_TRANSITIONS: Record<string, string[]> = {
	assigned: ['preparing'],
	preparing: ['ready', 'failed'],
	ready: ['completed']
};
```

Admin can override to any status via `PUT /api/orders/{orderId}/status`. Robot uses `POST /api/orders/{orderId}/status` and is bound by `STATUS_TRANSITIONS`.

## Nutritional Calculation

- **Formula:** `(ingredientValuePer100g * quantityGrams) / 100`
- **Both client AND server must calculate** — server recalculates on order submission to prevent tampering
- Server must validate `totalWeightG <= bowlSize` and reject if exceeded
- Calculation lives in `backend/src/lib/nutrition.ts`

## Phone & Address Validation

Colombian phone regex (used in `customerSchema`):

```typescript
/^(\+57)?[0-9]{10}$/;
```

Colombian address fields: `streetAddress`, `neighborhood`, `city`, `department`, `postalCode` (6 digits, optional).

## Database Schema Changes

- **Local dev:** `npm run db:push` is fine
- **Production:** Requires a migration file in `backend/prisma/migrations/`
- CI automatically runs `npx prisma migrate deploy` after Terraform apply
- Symptom of missing migration: local works, production returns 500 on endpoints using new columns

To create a migration:

```bash
npx prisma migrate dev --name descriptive_name
```

## Order Status Lifecycle

```
pending → queued → assigned → preparing → ready → completed
                                    ↓
                                  failed
```

`cancelled` is admin-only. Terminal states: `completed`, `failed`, `cancelled` — these free the assigned robot.

## Key File Locations

- Handlers: `backend/src/handlers/`
- DB client (Prisma singleton): `backend/src/lib/db.ts`
- Response helpers: `backend/src/lib/response.ts`
- Nutrition calculation: `backend/src/lib/nutrition.ts`
- Dev server: `backend/src/dev-server.ts`
- Prisma schema: `backend/prisma/schema.prisma`
- Shared types (source of truth): `packages/shared/src/types/index.ts`
