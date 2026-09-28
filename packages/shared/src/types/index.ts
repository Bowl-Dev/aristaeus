// ============================================
// Colombian Address Structure
// ============================================

export interface ColombianAddress {
	streetAddress: string; // e.g., "Calle 160A # 7G-16"
	neighborhood: string; // e.g., "Usaquén" (Barrio)
	city: string; // e.g., "Bogotá"
	department: string; // e.g., "Bogotá D.C." (32 departments + Bogotá D.C.)
	postalCode?: string; // e.g., "110131" (6 digits, optional)
}

// ============================================
// User (Customer) Types
// ============================================

export interface User {
	id: string; // UUID
	name: string;
	phone: string;
	email: string | null;
	address: ColombianAddress;
	createdAt: string;
	updatedAt: string;
}

// Customer data for order creation (subset of User)
export interface CustomerInfo {
	name: string;
	phone: string;
	email?: string;
	address: ColombianAddress;
}

// ============================================
// Ingredient types
// ============================================

export type IngredientCategory = 'protein' | 'base' | 'vegetable' | 'topping' | 'dressing';

export interface Ingredient {
	id: number;
	name: string;
	nameEs: string;
	nameEn: string;
	category: IngredientCategory;
	caloriesPer100g: number;
	proteinGPer100g: number;
	carbsGPer100g: number;
	fatGPer100g: number;
	fiberGPer100g: number | null;
	available: boolean;
	displayOrder: number | null;
	pricePerG: number;
	imageUrl?: string | null;
}

export interface MenuIngredientItem {
	ingredientId: number;
	ingredientName: string;
	ingredientNameEs: string;
	ingredientNameEn: string;
	quantityGrams: number;
	sequenceOrder: number;
	caloriesPer100g: number;
	proteinGPer100g: number;
	carbsGPer100g: number;
	fatGPer100g: number;
	fiberGPer100g: number | null;
	pricePerG: number;
}

export interface Menu {
	id: number;
	nameEs: string;
	nameEn: string;
	descriptionEs: string;
	descriptionEn: string;
	bowlSize: BowlSize;
	active: boolean;
	displayOrder: number | null;
	imageUrl?: string | null;
	ingredients: MenuIngredientItem[];
}

// Bowl size options (in grams)
export type BowlSize = 250 | 450 | 600;
export type BowlSizePrice = 1200 | 1300 | 1400; //Bowl packaging prices in COP

export const BOWL_SIZES: readonly BowlSize[] = [250, 450, 600] as const;
export const BOWL_SIZE_PRICES: readonly BowlSizePrice[] = [1200, 1300, 1400] as const;

// Flat surcharge (COP) added to a bowl when the customer opts to include cutlery.
export const CUTLERY_PRICE = 300;

/**
 * Round a COP amount to the nearest 100, since 100 is the smallest coin in
 * Colombian currency. The one copy client and server both price with.
 */
export function roundToNearestCoin(amount: number): number {
	return Math.round(amount / 100) * 100;
}

// Order types
export type OrderStatus =
	| 'pending'
	| 'queued'
	| 'assigned'
	| 'preparing'
	| 'ready'
	| 'completed'
	| 'cancelled'
	| 'failed'
	// Created by a checkout, not yet paid — the kitchen must not start these.
	| 'awaiting_payment'
	// The checkout's payment was declined, voided, errored or abandoned.
	| 'payment_failed';

export interface OrderItem {
	id: number;
	orderId: number;
	ingredientId: number;
	quantityGrams: number;
	sequenceOrder: number;
}

export interface Order {
	id: number;
	userId: string; // UUID reference to User
	bowlSize: BowlSize;
	status: OrderStatus;
	includeCutlery: boolean;
	totalCalories: number | null;
	totalProteinG: number | null;
	totalCarbsG: number | null;
	totalFatG: number | null;
	totalFiberG: number | null;
	totalWeightG: number | null;
	createdAt: string;
	assignedAt: string | null;
	startedAt: string | null;
	completedAt: string | null;
	totalPrice: number;
}

// Nutritional summary
export interface NutritionalSummary {
	calories: number;
	proteinG: number;
	carbsG: number;
	fatG: number;
	fiberG: number;
	totalWeightG: number;
	totalPrice: number;
}

// Bowl builder types (client-side)
export interface SelectedIngredient {
	ingredient: Ingredient;
	quantityGrams: number;
}

export interface BowlConfiguration {
	bowlSize: BowlSize;
	customer: CustomerInfo;
	selectedIngredients: SelectedIngredient[];
}

// ============================================
// Admin API Types
// ============================================

// Pagination parameters for listing orders
export interface ListOrdersParams {
	status?: OrderStatus | 'all';
	limit?: number;
	offset?: number;
}

// Admin order item with category info
export interface AdminOrderItem {
	ingredientName: string;
	ingredientNameEs: string;
	ingredientNameEn: string;
	ingredientCategory: IngredientCategory;
	quantityGrams: number;
	sequenceOrder: number;
}

// Admin order view with user details
export interface AdminOrder {
	id: number;
	/** The checkout's AG-#### number; null for orders placed before checkout existed. */
	orderNumber: number | null;
	bowlSize: number;
	includeCutlery: boolean;
	user: {
		id: string;
		name: string;
		phone: string;
		email: string | null;
		address: ColombianAddress;
	};
	deliveryInstructions?: string | null;
	status: string;
	items: AdminOrderItem[];
	totalWeightG: number;
	totalCalories: number;
	totalProteinG: number;
	totalCarbsG: number;
	totalFatG: number;
	totalFiberG: number;
	totalPrice: number;
	createdAt: string;
	assignedAt: string | null;
	startedAt: string | null;
	completedAt: string | null;
}

// Paginated orders response
export interface PaginatedOrdersResponse {
	orders: AdminOrder[];
	total: number;
	limit: number;
	offset: number;
}

// ============================================
// User Check API Types
// ============================================

export interface CheckPhoneResponse {
	exists: boolean;
	user?: {
		name: string;
		email: string | null;
		address: ColombianAddress | null;
	};
}

// ============================================
// Checkout (Wompi) API Types
// ============================================

export interface CheckoutBowl {
	bowlSize: BowlSize;
	items: Array<{ ingredientId: number; quantityGrams: number }>;
	includeCutlery: boolean;
	quantity: number;
}

/** POST /api/checkout/quote — prices a cart. No writes. */
export interface CheckoutQuoteRequest {
	/** Free-form Bogotá address, e.g. "Calle 125 # 18A-05, Apto 302". */
	address: string;
	bowls: CheckoutBowl[];
	couponCode?: string;
	/** Needed for first-purchase-only coupons. */
	phone?: string;
}

export interface AppliedCoupon {
	code: string;
	type: CouponType;
	value: number | null;
}

/**
 * All amounts in COP, each a multiple of 100.
 * total = subtotal + deliveryFee - discount + serviceFee
 */
export interface CheckoutQuote {
	subtotal: number;
	deliveryFee: number;
	discount: number;
	serviceFee: number;
	total: number;
	coupon: AppliedCoupon | null;
	/** Set when a couponCode was sent and did not apply. */
	couponRejection: { reason: CouponRejection; minBowls?: number } | null;
}

/** POST /api/checkout — creates the checkout + its orders, returns Wompi params. */
export interface CreateCheckoutRequest extends CheckoutQuoteRequest {
	customer: { name: string; phone: string };
	deliveryInstructions?: string;
}

export interface CreateCheckoutResponse {
	checkoutId: string;
	/** Shown as AG-#### */
	orderNumber: number;
	/** Wompi Web Checkout params. The frontend adds `redirect-url` itself. */
	reference: string;
	amountInCents: number;
	currency: 'COP';
	signature: string;
	publicKey: string;
}

export type PaymentStatus = 'awaiting_payment' | 'paid' | 'payment_failed';

/** GET /api/checkout/{id} */
export interface CheckoutStatusResponse {
	checkoutId: string;
	orderNumber: number;
	paymentStatus: PaymentStatus;
	total: number;
}

// ============================================
// Coupon API Types
// ============================================

/** Benefit types the backend can price. */
export type CouponType = 'percent' | 'fixed' | 'free_shipping';

/** Why a code did not apply; maps to `coupon.reason.*` in i18n. */
export type CouponRejection =
	| 'not_found'
	| 'inactive'
	| 'not_started'
	| 'expired'
	| 'budget_exhausted'
	| 'not_first_purchase'
	| 'min_bowls';

export interface CouponRecord {
	id: number;
	code: string;
	campaignName: string;
	description: string | null;
	type: CouponType;
	value: number | null;
	startsAt: string;
	endsAt: string;
	budgetTotal: number;
	budgetRemaining: number;
	minBowls: number;
	firstPurchaseOnly: boolean;
	active: boolean;
	createdAt: string;
}

export interface CouponsResponse {
	coupons: CouponRecord[];
	count: number;
}

export interface CreateCouponRequest {
	code: string;
	campaignName: string;
	description?: string;
	type: CouponType;
	value?: number;
	startsAt: string;
	endsAt: string;
	budgetTotal: number;
	minBowls: number;
	firstPurchaseOnly: boolean;
	active: boolean;
}
