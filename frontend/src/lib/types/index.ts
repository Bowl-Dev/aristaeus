// Re-export shared types
export type {
	Ingredient,
	IngredientCategory,
	BowlSize,
	NutritionalSummary,
	SelectedIngredient,
	BowlConfiguration,
	OrderStatus,
	Order,
	OrderItem,
	CreateOrderRequest,
	CreateOrderResponse,
	OrderStatusResponse
} from '@aristaeus/shared';

export { BOWL_SIZES } from '@aristaeus/shared';

// Frontend-specific constants
export const BOWL_SIZE_LABELS: Record<import('@aristaeus/shared').BowlSize, string> = {
	250: 'Small (250g)',
	320: 'Medium (320g)',
	600: 'Large (600g)'
};
