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
	CreateOrderRequest,
	CreateOrderResponse,
	OrderStatusResponse,
	ColombianAddress,
	User,
	CustomerInfo,
	Menu,
	MenuIngredientItem
} from '@aristaeus/shared';

export { BOWL_SIZES } from '@aristaeus/shared';
export { BOWL_SIZE_PRICES } from '@aristaeus/shared';

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
