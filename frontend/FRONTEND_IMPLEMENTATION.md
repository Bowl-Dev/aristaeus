# Aristaeus Frontend - Implementation Guide

**Project:** Automated Bowl Kitchen - Frontend
**Framework:** SvelteKit 2.0 + TypeScript + Svelte 5
**Deployment:** GitHub Pages (Static)
**Status:** MVP Complete
**Last Updated:** 2026-01-09

---

## Architecture Overview

The frontend is deployed as a **static site** to GitHub Pages and communicates with the AWS Lambda backend via HTTP API calls.

```
GitHub Pages (Static)  ──HTTP──►  AWS API Gateway  ──►  Lambda  ──►  Aurora
```

**Key Points:**

- No server-side rendering (SSR) - fully client-side rendered (SPA)
- API routes are NOT in the frontend - they're in the backend workspace
- Uses `@sveltejs/adapter-static` for GitHub Pages deployment
- API client handles all communication with AWS backend

---

## Quick Reference

### Project Structure

```
frontend/
├── src/
│   ├── routes/
│   │   ├── +page.svelte              # Bowl builder (main page)
│   │   ├── +layout.svelte            # Layout wrapper
│   │   ├── +layout.ts                # Static rendering config (prerender, ssr=false)
│   │   ├── order/
│   │   │   └── [id]/
│   │   │       └── +page.svelte      # Order status page
│   │   └── admin/
│   │       └── orders/
│   │           └── +page.svelte      # Admin testing interface
│   ├── lib/
│   │   ├── api/
│   │   │   └── client.ts             # API client for AWS backend
│   │   ├── components/
│   │   │   ├── IngredientCard.svelte
│   │   │   ├── BowlSizeSelector.svelte
│   │   │   ├── NutritionalSummary.svelte
│   │   │   └── CapacityBar.svelte
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript interfaces
│   │   ├── i18n/
│   │   │   └── index.ts              # Internationalization
│   │   └── stores/                   # (optional) Svelte stores
│   ├── app.html
│   └── app.d.ts
├── static/
│   ├── .nojekyll                     # Prevents Jekyll processing on GitHub Pages
│   └── robots.txt
├── .env.example                      # Environment variable template
├── package.json
├── svelte.config.js                  # adapter-static configuration
├── tsconfig.json
└── vite.config.ts
```

---

## TypeScript Type Definitions

### Core Types (src/lib/types/index.ts)

```typescript
// Bowl size options
export type BowlSize = 250 | 320 | 480;

export const BOWL_SIZES: BowlSize[] = [250, 320, 480];

export const BOWL_SIZE_LABELS: Record<BowlSize, string> = {
	250: 'Small (250g)',
	320: 'Medium (320g)',
	480: 'Large (480g)'
};

// Ingredient from database/API
export interface Ingredient {
	id: number;
	name: string;
	category: 'protein' | 'base' | 'vegetable' | 'topping' | 'dressing';

	// Nutritional values per 100g
	calories_per_100g: number;
	protein_g_per_100g: number;
	carbs_g_per_100g: number;
	fat_g_per_100g: number;
	fiber_g_per_100g: number | null;

	available: boolean;
	display_order?: number;
}

// Item in current bowl being built
export interface BowlItem {
	ingredient_id: number;
	ingredient: Ingredient; // Denormalized for easy access
	quantity_grams: number;
	sequence_order: number;
}

// Nutritional summary
export interface NutritionalSummary {
	total_calories: number;
	total_protein_g: number;
	total_carbs_g: number;
	total_fat_g: number;
	total_fiber_g: number;
	total_weight_g: number;
}

// Complete bowl state
export interface Bowl {
	bowl_size: BowlSize | null; // Selected bowl size
	items: BowlItem[];
	nutritionalSummary: NutritionalSummary;
}

// Order creation request payload
export interface CreateOrderRequest {
	bowl_size: BowlSize;
	items: {
		ingredient_id: number;
		quantity_grams: number;
		sequence_order: number;
	}[];
	nutritional_summary: NutritionalSummary;
}

// Order response from API
export interface Order {
	id: number;
	bowl_size: BowlSize;
	status: 'pending' | 'queued' | 'assigned' | 'preparing' | 'ready' | 'completed' | 'failed';
	items?: {
		ingredient_name: string;
		quantity_grams: number;
		sequence_order: number;
	}[];
	nutritional_summary?: NutritionalSummary;
	created_at: string;
	assigned_robot_id?: number | null;
}

// API response wrappers
export interface IngredientsResponse {
	ingredients: Ingredient[];
}

export interface CreateOrderResponse {
	order_id: number;
	status: string;
	created_at: string;
}
```

---

## State Management

### Bowl Store (src/lib/stores/bowl.ts)

Use Svelte's built-in stores for reactive state management:

```typescript
import { writable, derived } from 'svelte/store';
import type { BowlItem, NutritionalSummary, Ingredient, BowlSize } from '$lib/types';
import { calculateNutrition } from '$lib/utils/nutrition';

// Selected bowl size
export const selectedBowlSize = writable<BowlSize | null>(null);

// Bowl items
export const bowlItems = writable<BowlItem[]>([]);

// Derived nutritional summary (auto-recalculates when items change)
export const nutritionalSummary = derived(bowlItems, ($items) => calculateNutrition($items));

// Derived remaining capacity
export const remainingCapacity = derived(
	[selectedBowlSize, nutritionalSummary],
	([$size, $nutrition]) => {
		if (!$size) return null;
		return $size - $nutrition.total_weight_g;
	}
);

// Derived capacity exceeded flag
export const capacityExceeded = derived(
	remainingCapacity,
	($remaining) => $remaining !== null && $remaining < 0
);

// Helper functions
export function setBowlSize(size: BowlSize) {
	selectedBowlSize.set(size);
}

export function addIngredient(ingredient: Ingredient, quantity_grams: number = 100) {
	bowlItems.update((items) => {
		const sequence_order = items.length + 1;
		return [
			...items,
			{
				ingredient_id: ingredient.id,
				ingredient,
				quantity_grams,
				sequence_order
			}
		];
	});
}

export function removeIngredient(ingredient_id: number) {
	bowlItems.update((items) => {
		const filtered = items.filter((item) => item.ingredient_id !== ingredient_id);
		// Resequence
		return filtered.map((item, index) => ({
			...item,
			sequence_order: index + 1
		}));
	});
}

export function updateQuantity(ingredient_id: number, quantity_grams: number) {
	bowlItems.update((items) =>
		items.map((item) => (item.ingredient_id === ingredient_id ? { ...item, quantity_grams } : item))
	);
}

export function clearBowl() {
	bowlItems.set([]);
	selectedBowlSize.set(null);
}
```

---

## Nutritional Calculation Logic

### Calculation Utility (src/lib/utils/nutrition.ts)

**CRITICAL:** This must match server-side validation logic exactly.

```typescript
import type { BowlItem, NutritionalSummary } from '$lib/types';

export function calculateNutrition(items: BowlItem[]): NutritionalSummary {
	const totals: NutritionalSummary = {
		total_calories: 0,
		total_protein_g: 0,
		total_carbs_g: 0,
		total_fat_g: 0,
		total_fiber_g: 0,
		total_weight_g: 0
	};

	items.forEach((item) => {
		const { ingredient, quantity_grams } = item;
		const multiplier = quantity_grams / 100; // Per 100g basis

		totals.total_calories += ingredient.calories_per_100g * multiplier;
		totals.total_protein_g += ingredient.protein_g_per_100g * multiplier;
		totals.total_carbs_g += ingredient.carbs_g_per_100g * multiplier;
		totals.total_fat_g += ingredient.fat_g_per_100g * multiplier;
		totals.total_fiber_g += (ingredient.fiber_g_per_100g || 0) * multiplier;
		totals.total_weight_g += quantity_grams;
	});

	// Round to 2 decimal places for display
	return {
		total_calories: Math.round(totals.total_calories * 100) / 100,
		total_protein_g: Math.round(totals.total_protein_g * 100) / 100,
		total_carbs_g: Math.round(totals.total_carbs_g * 100) / 100,
		total_fat_g: Math.round(totals.total_fat_g * 100) / 100,
		total_fiber_g: Math.round(totals.total_fiber_g * 100) / 100,
		total_weight_g: Math.round(totals.total_weight_g * 100) / 100
	};
}

// Helper for formatting display
export function formatMacro(value: number, unit: string = 'g'): string {
	return `${value.toFixed(1)}${unit}`;
}
```

---

## Component Specifications

### 1. IngredientSelector.svelte

**Purpose:** Display ingredients by category, allow user to add to bowl

**Props:**

```typescript
export let ingredients: Ingredient[];
```

**Behavior:**

- Group ingredients by category
- Display nutritional info on hover/expand
- "Add to Bowl" button for each ingredient
- Default quantity selector (e.g., 50g, 100g, 150g quick picks)
- Disable if already in bowl

**Events:**

- Dispatch `add` event with ingredient data

**Template Structure:**

```svelte
<script lang="ts">
	import type { Ingredient } from '$lib/types';
	import { addIngredient } from '$lib/stores/bowl';

	export let ingredients: Ingredient[];

	// Group by category
	$: grouped = ingredients.reduce(
		(acc, ing) => {
			if (!acc[ing.category]) acc[ing.category] = [];
			acc[ing.category].push(ing);
			return acc;
		},
		{} as Record<string, Ingredient[]>
	);

	const categories = ['protein', 'base', 'vegetable', 'topping', 'dressing'];
</script>

<!-- UI implementation -->
```

### 2. NutritionalDisplay.svelte

**Purpose:** Show real-time nutritional totals

**Props:**

```typescript
// Uses store directly, no props needed
```

**Behavior:**

- Subscribe to `nutritionalSummary` store
- Display totals in clear format
- Highlight macros (calories, protein, carbs, fat, fiber)
- Visual progress bars or charts (optional)
- Total weight display

**Template Structure:**

```svelte
<script lang="ts">
	import { nutritionalSummary } from '$lib/stores/bowl';
	import { formatMacro } from '$lib/utils/nutrition';
</script>

<div class="nutrition-panel">
	<h3>Nutritional Facts</h3>
	<div class="macro-grid">
		<div class="macro">
			<span class="label">Calories</span>
			<span class="value">{$nutritionalSummary.total_calories.toFixed(0)}</span>
		</div>
		<div class="macro">
			<span class="label">Protein</span>
			<span class="value">{formatMacro($nutritionalSummary.total_protein_g)}</span>
		</div>
		<!-- ... other macros ... -->
	</div>
	<div class="total-weight">
		Total: {formatMacro($nutritionalSummary.total_weight_g)}
	</div>
</div>
```

### 3. OrderSummary.svelte

**Purpose:** Show current bowl items, quantities, submit order

**Props:**

```typescript
// Uses stores directly
```

**Behavior:**

- List all items in bowl with quantities
- Allow quantity adjustment (increment/decrement)
- Allow item removal
- Show sequence order (assembly order)
- Validate minimum/maximum constraints
- "Submit Order" button
- Handle order submission

**Events:**

- Handle API call to POST /api/orders
- Navigate to order status page on success

**Template Structure:**

```svelte
<script lang="ts">
	import { bowlItems, nutritionalSummary, clearBowl } from '$lib/stores/bowl';
	import { goto } from '$app/navigation';
	import type { CreateOrderRequest } from '$lib/types';

	let submitting = false;
	let error: string | null = null;

	async function submitOrder() {
		submitting = true;
		error = null;

		const payload: CreateOrderRequest = {
			items: $bowlItems.map((item) => ({
				ingredient_id: item.ingredient_id,
				quantity_grams: item.quantity_grams,
				sequence_order: item.sequence_order
			})),
			nutritional_summary: $nutritionalSummary
		};

		try {
			const response = await fetch('/api/orders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				throw new Error('Order submission failed');
			}

			const data = await response.json();
			clearBowl();
			goto(`/order/${data.order_id}`);
		} catch (err) {
			error = err.message;
		} finally {
			submitting = false;
		}
	}
</script>

<!-- Bowl items list with controls + submit button -->
```

---

## Page Implementations

### Main Page (src/routes/+page.ts)

Load ingredients data:

```typescript
import type { PageLoad } from './$types';
import type { IngredientsResponse } from '$lib/types';

export const load: PageLoad = async ({ fetch }) => {
	const response = await fetch('/api/ingredients');
	const data: IngredientsResponse = await response.json();

	return {
		ingredients: data.ingredients
	};
};
```

### Main Page Component (src/routes/+page.svelte)

```svelte
<script lang="ts">
	import type { PageData } from './$types';
	import IngredientSelector from '$lib/components/IngredientSelector.svelte';
	import NutritionalDisplay from '$lib/components/NutritionalDisplay.svelte';
	import OrderSummary from '$lib/components/OrderSummary.svelte';
	import { bowlItems } from '$lib/stores/bowl';

	export let data: PageData;
</script>

<main>
	<h1>Build Your Bowl</h1>

	<div class="builder-layout">
		<section class="ingredient-selection">
			<IngredientSelector ingredients={data.ingredients} />
		</section>

		<aside class="bowl-summary">
			<NutritionalDisplay />

			{#if $bowlItems.length > 0}
				<OrderSummary />
			{:else}
				<p class="empty-state">Start adding ingredients to build your bowl</p>
			{/if}
		</aside>
	</div>
</main>

<style>
	.builder-layout {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 2rem;
		padding: 2rem;
	}

	@media (max-width: 768px) {
		.builder-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
```

### Order Status Page (src/routes/order/[id]/+page.ts)

```typescript
import type { PageLoad } from './$types';
import type { Order } from '$lib/types';

export const load: PageLoad = async ({ params, fetch }) => {
	const response = await fetch(`/api/orders/${params.id}`);
	const order: Order = await response.json();

	return { order };
};
```

### Order Status Component (src/routes/order/[id]/+page.svelte)

```svelte
<script lang="ts">
	import type { PageData } from './$types';
	export let data: PageData;

	const statusLabels = {
		pending: 'Order Received',
		queued: 'Waiting for Robot',
		assigned: 'Robot Assigned',
		preparing: 'Preparing Your Bowl',
		ready: 'Ready for Pickup!',
		completed: 'Completed',
		failed: 'Error - Please contact staff'
	};
</script>

<main>
	<h1>Order #{data.order.id}</h1>

	<div class="status-display">
		<h2>{statusLabels[data.order.status]}</h2>
		<p class="status-badge {data.order.status}">{data.order.status}</p>
	</div>

	{#if data.order.items}
		<section class="order-items">
			<h3>Your Bowl</h3>
			<ul>
				{#each data.order.items as item}
					<li>
						{item.ingredient_name} - {item.quantity_grams}g
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.order.nutritional_summary}
		<section class="nutrition">
			<h3>Nutritional Information</h3>
			<div class="nutrition-grid">
				<div>Calories: {data.order.nutritional_summary.total_calories}</div>
				<div>Protein: {data.order.nutritional_summary.total_protein_g}g</div>
				<div>Carbs: {data.order.nutritional_summary.total_carbs_g}g</div>
				<div>Fat: {data.order.nutritional_summary.total_fat_g}g</div>
			</div>
		</section>
	{/if}

	<p class="timestamp">Ordered: {new Date(data.order.created_at).toLocaleString()}</p>
</main>
```

---

## API Client Implementation

The frontend communicates with the AWS Lambda backend via an API client. **There are no local API routes** - all API logic is in the `backend/` workspace.

### API Client (src/lib/api/client.ts)

```typescript
import type {
	Ingredient,
	CreateOrderRequest,
	CreateOrderResponse,
	OrderStatusResponse
} from '@aristaeus/shared';

// API base URL - configured via environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly details?: unknown
	) {
		super(message);
		this.name = 'ApiError';
	}
}

/**
 * Fetch all available ingredients
 */
export async function getIngredients(): Promise<Ingredient[]> {
	const response = await fetch(`${API_BASE_URL}/api/ingredients`);
	if (!response.ok) throw new ApiError(response.status, 'Failed to fetch ingredients');
	const data = await response.json();
	return data.ingredients;
}

/**
 * Create a new order
 */
export async function createOrder(order: CreateOrderRequest): Promise<CreateOrderResponse> {
	const response = await fetch(`${API_BASE_URL}/api/orders`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(order)
	});
	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new ApiError(response.status, error.message || 'Failed to create order');
	}
	return response.json();
}

/**
 * Get order status by ID
 */
export async function getOrderStatus(orderId: number): Promise<OrderStatusResponse> {
	const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`);
	if (!response.ok) throw new ApiError(response.status, 'Order not found');
	return response.json();
}

/**
 * List all orders (admin)
 */
export async function listOrders(): Promise<AdminOrder[]> {
	const response = await apiFetch<{ orders: AdminOrder[] }>('/api/orders');
	return response.orders;
}

/**
 * Update order status (admin)
 */
export async function updateOrderStatus(
	orderId: number,
	status: string
): Promise<{ success: boolean }> {
	return apiFetch(`/api/orders/${orderId}/status`, {
		method: 'PUT',
		body: JSON.stringify({ status })
	});
}
```

### Environment Configuration

Create `.env` file for local development:

```bash
# Local backend (serverless-offline)
VITE_API_URL=http://localhost:3000

# Production (AWS API Gateway) - set in GitHub repo variables
# VITE_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com
```

### Usage in Components

```svelte
<script lang="ts">
	import { getIngredients, createOrder, ApiError } from '$lib/api/client';
	import { onMount } from 'svelte';

	let ingredients = $state<Ingredient[]>([]);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			ingredients = await getIngredients();
		} catch (e) {
			if (e instanceof ApiError) {
				error = e.message;
			}
		}
	});
</script>
```

---

## Styling Guidelines

### CSS Variables (Add to src/app.html or global styles)

```css
:root {
	/* Colors */
	--color-primary: #4caf50;
	--color-secondary: #ff9800;
	--color-background: #fafafa;
	--color-surface: #ffffff;
	--color-text: #333333;
	--color-text-secondary: #666666;

	/* Nutritional macro colors */
	--color-protein: #e91e63;
	--color-carbs: #2196f3;
	--color-fat: #ffc107;
	--color-fiber: #9c27b0;

	/* Spacing */
	--spacing-xs: 0.25rem;
	--spacing-sm: 0.5rem;
	--spacing-md: 1rem;
	--spacing-lg: 1.5rem;
	--spacing-xl: 2rem;

	/* Typography */
	--font-family: system-ui, -apple-system, sans-serif;
	--font-size-base: 16px;
	--font-size-lg: 1.25rem;
	--font-size-xl: 1.5rem;
	--font-size-2xl: 2rem;
}
```

### Design Principles

- Mobile-first responsive design
- Clear visual hierarchy (ingredients → bowl → nutrition)
- Accessible (ARIA labels, keyboard navigation)
- Loading states for async operations
- Error states with clear messaging

---

## Validation Rules

### Client-Side Validation

#### Bowl Size Validation

1. **Required:** User must select a bowl size before submitting order
2. **Valid sizes:** 250g, 320g, or 480g only

#### Ingredient Validation

1. **Minimum quantity:** 10g per ingredient
2. **Maximum quantity:** 500g per ingredient (suggested, but limited by bowl capacity)
3. **Bowl capacity:** Total ingredient weight cannot exceed selected bowl size
4. **Maximum ingredients:** 10 per bowl (suggested)
5. **Required:** At least 1 ingredient to submit order

#### Real-time Validation

1. **Capacity feedback:** Show remaining capacity as user adds ingredients
2. **Prevent exceeding:** Disable ingredient input or show error when approaching/at capacity
3. **Visual feedback:** Highlight capacity bar/indicator when nearing limit

### Error Messages

```typescript
const validationErrors = {
	// Bowl size errors
	noBowlSize: 'Please select a bowl size',
	invalidBowlSize: 'Invalid bowl size selected',

	// Ingredient errors
	minQuantity: 'Quantity must be at least 10g',
	maxQuantity: 'Quantity cannot exceed 500g',
	capacityExceeded: (selected: number, capacity: number) =>
		`Total weight (${selected}g) exceeds bowl capacity (${capacity}g)`,
	capacityWarning: (remaining: number) => `Only ${remaining}g remaining in bowl`,
	maxIngredients: 'Maximum 10 ingredients per bowl',
	minIngredients: 'Add at least one ingredient to your bowl',

	// Server errors
	serverError: 'Unable to submit order. Please try again.'
};
```

---

## Environment Variables

Create `.env` file (not committed) - see `.env.example` for template:

```bash
# API URL for the AWS Lambda backend
# Development (local serverless-offline):
VITE_API_URL=http://localhost:3000

# Production (AWS API Gateway):
# VITE_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com

# Base path for GitHub Pages deployment (if not using custom domain)
# For https://username.github.io/aristaeus/, set:
# BASE_PATH=/aristaeus
```

**Note:** The `VITE_` prefix is required for Vite to expose the variable to client-side code.

---

## Deployment

### GitHub Pages Configuration

The frontend uses `@sveltejs/adapter-static` for static site generation.

**svelte.config.js:**

```javascript
import adapter from '@sveltejs/adapter-static';

const config = {
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html', // SPA fallback
			precompress: false,
			strict: true
		}),
		paths: {
			base: process.env.BASE_PATH || ''
		}
	}
};
```

**+layout.ts (required for static adapter):**

```typescript
export const prerender = true;
export const ssr = false;
```

### Deployment Methods

**1. Automatic (GitHub Actions):**
Push to `main` branch triggers `.github/workflows/deploy-frontend.yml`

**2. Manual:**

```bash
cd frontend
npm run deploy:gh-pages
```

### GitHub Repository Settings

1. Go to Settings → Pages
2. Source: "GitHub Actions"
3. Add repository variable: `VITE_API_URL` with your API Gateway URL

---

## Testing Checklist

### Functionality

- [ ] Load ingredients from API
- [ ] Add ingredient to bowl
- [ ] Remove ingredient from bowl
- [ ] Update ingredient quantity
- [ ] Nutritional values update in real-time
- [ ] Submit order successfully
- [ ] Navigate to order status page
- [ ] Display order status correctly

### Edge Cases

- [ ] Empty bowl cannot be submitted
- [ ] Quantities below minimum show error
- [ ] Quantities above maximum show error
- [ ] Network errors handled gracefully
- [ ] Loading states displayed during API calls

### Responsive Design

- [ ] Mobile layout works correctly
- [ ] Tablet layout works correctly
- [ ] Desktop layout works correctly
- [ ] Touch interactions work on mobile

---

## Implementation Status

All MVP phases have been completed:

1. **Phase 1: Setup** ✅
   - Project structure created
   - Dependencies installed
   - Type definitions implemented
   - Utility functions created

2. **Phase 2: State Management** ✅
   - Bowl state using Svelte 5 runes (`$state`, `$derived`)
   - Real-time nutritional calculation
   - Capacity tracking and validation

3. **Phase 3: Components** ✅
   - Bowl builder on main page (`+page.svelte`)
   - Ingredient selection by category
   - Nutritional summary display
   - Order submission flow

4. **Phase 4: API Integration** ✅
   - API client connects to AWS Lambda backend
   - Ingredients fetched from database
   - Orders created and tracked
   - Admin page for order management

5. **Phase 5: Styling** ✅
   - Responsive design (mobile + desktop)
   - Loading and error states
   - Success feedback on order submission
   - Internationalization (English/Spanish)

6. **Phase 6: Backend Integration** ✅
   - Connected to Aurora PostgreSQL via Prisma
   - Server-side validation
   - End-to-end order flow tested
   - Deployed to production

---

## Database Connection (Future)

When ready to connect to PostgreSQL:

```typescript
// src/lib/server/db.ts
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
	connectionString: process.env.DATABASE_URL
});

export const db = {
	query: (text: string, params?: any[]) => pool.query(text, params),

	// Helper methods
	getIngredients: async () => {
		const result = await pool.query(
			'SELECT * FROM ingredients WHERE available = true ORDER BY category, display_order, name'
		);
		return result.rows;
	},

	createOrder: async (items: any[], nutritionalSummary: any) => {
		// Transaction to insert order + order_items
		// Return order_id
	},

	getOrder: async (orderId: number) => {
		// Query with joins
		// Return full order details
	}
};
```

---

## Common Patterns

### Fetching Data in SvelteKit

```typescript
// Load function (runs on server and client)
export const load: PageLoad = async ({ fetch, params }) => {
	const response = await fetch('/api/endpoint');
	const data = await response.json();
	return { data };
};
```

### Form Handling

```svelte
<script>
	let submitting = false;
	let error: string | null = null;

	async function handleSubmit() {
		submitting = true;
		error = null;

		try {
			const response = await fetch('/api/endpoint', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!response.ok) throw new Error('Request failed');

			const data = await response.json();
			// Handle success
		} catch (err) {
			error = err.message;
		} finally {
			submitting = false;
		}
	}
</script>
```

### Reactive Statements

```svelte
<script>
	let items = [];

	// Automatically recalculates when items changes
	$: total = items.reduce((sum, item) => sum + item.value, 0);
</script>
```

---

## Key Reminders

1. **Nutritional calculations MUST match server-side** - Test thoroughly
2. **Always validate on server** - Never trust client data
3. **Use TypeScript strictly** - Catch errors at compile time
4. **Keep components focused** - Single responsibility
5. **Test on multiple devices** - Mobile usage likely
6. **Handle loading states** - Provide feedback to user
7. **Handle errors gracefully** - Clear, actionable error messages

---

**END OF FRONTEND IMPLEMENTATION GUIDE**
