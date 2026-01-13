// Ingredient types
export type IngredientCategory = 'protein' | 'base' | 'vegetable' | 'topping' | 'dressing';

export interface Ingredient {
  id: number;
  name: string;
  category: IngredientCategory;
  caloriesPer100g: number;
  proteinGPer100g: number;
  carbsGPer100g: number;
  fatGPer100g: number;
  fiberGPer100g: number | null;
  available: boolean;
  displayOrder: number | null;
}

// Bowl size options (in grams)
export type BowlSize = 250 | 450 | 600;

export const BOWL_SIZES: readonly BowlSize[] = [250, 450, 600] as const;

// Order types
export type OrderStatus =
  | 'pending'
  | 'queued'
  | 'assigned'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface OrderItem {
  id: number;
  orderId: number;
  ingredientId: number;
  quantityGrams: number;
  sequenceOrder: number;
}

export interface Order {
  id: number;
  bowlSize: BowlSize;
  status: OrderStatus;
  totalCalories: number | null;
  totalProteinG: number | null;
  totalCarbsG: number | null;
  totalFatG: number | null;
  totalFiberG: number | null;
  totalWeightG: number | null;
  assignedRobotId: number | null;
  createdAt: string;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

// Robot types
export type RobotStatus = 'online' | 'offline' | 'busy' | 'error';

export interface Robot {
  id: number;
  name: string;
  identifier: string;
  status: RobotStatus;
  currentOrderId: number | null;
  lastHeartbeat: string | null;
}

// Nutritional summary
export interface NutritionalSummary {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  totalWeightG: number;
}

// Bowl builder types (client-side)
export interface SelectedIngredient {
  ingredient: Ingredient;
  quantityGrams: number;
}

export interface BowlConfiguration {
  bowlSize: BowlSize;
  customerName: string;
  selectedIngredients: SelectedIngredient[];
}

// API request/response types
export interface CreateOrderRequest {
  bowlSize: BowlSize;
  customerName: string;
  items: Array<{
    ingredientId: number;
    quantityGrams: number;
  }>;
}

export interface CreateOrderResponse {
  orderId: number;
  status: OrderStatus;
  estimatedWaitTimeMinutes?: number;
}

export interface OrderStatusResponse {
  orderId: number;
  status: OrderStatus;
  nutritionalSummary: NutritionalSummary;
  createdAt: string;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}
