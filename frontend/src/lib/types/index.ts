// Re-export shared types
export type {
	Ingredient,
	IngredientCategory,
	BowlSize,
	BowlSizePrice,
	NutritionalSummary,
	SelectedIngredient,
	BowlConfiguration,
	OrderStatus,
	Order,
	OrderItem,
	ColombianAddress,
	User,
	CustomerInfo,
	Menu,
	MenuIngredientItem,
	AdminOrder,
	AdminOrderItem,
	ListOrdersParams,
	PaginatedOrdersResponse,
	CheckPhoneResponse,
	CheckoutBowl,
	CheckoutQuoteRequest,
	CheckoutQuote,
	AppliedCoupon,
	CreateCheckoutRequest,
	CreateCheckoutResponse,
	CheckoutStatusResponse,
	PaymentStatus,
	CouponType,
	CouponRejection,
	CouponRecord,
	CouponsResponse,
	CreateCouponRequest,
	UpdateCouponRequest
} from '@aristaeus/shared';

export { BOWL_SIZES, BOWL_SIZE_PRICES, CUTLERY_PRICE, roundToNearestCoin } from '@aristaeus/shared';

// ponytail: BOWL_SIZE_LABELS and DRESSING_CONTAINER_GRAMS have no callers, and the
// labels are untranslated English besides. Delete both when the size picker copy
// is next touched.
// Frontend-specific constants
export const BOWL_SIZE_LABELS: Record<import('@aristaeus/shared').BowlSize, string> = {
	250: 'Small (250g)',
	450: 'Medium (450g)',
	600: 'Large (600g)'
};

// Dressing container size in grams (nominal full container)
export const DRESSING_CONTAINER_GRAMS = 25;

// Dressing quantity step in grams — half a container, so dressings can be
// ordered in half-container increments (½, 1, 1½, … containers).
export const DRESSING_STEP_GRAMS = 12;
