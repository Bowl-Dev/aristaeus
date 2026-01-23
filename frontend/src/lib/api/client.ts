/**
 * API Client for Aristaeus Backend
 * Handles all HTTP requests to the AWS Lambda backend
 */

import type {
  Ingredient,
  CreateOrderRequest,
  CreateOrderResponse,
  OrderStatusResponse,
} from '@aristaeus/shared';

// API base URL - configured via environment variable
// In development: http://localhost:3000
// In production: Your API Gateway URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorBody.message || `HTTP ${response.status}: ${response.statusText}`,
      errorBody
    );
  }

  return response.json();
}

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

// ============================================
// API Functions
// ============================================

/**
 * Fetch all available ingredients
 */
export async function getIngredients(): Promise<Ingredient[]> {
  const response = await apiFetch<{ ingredients: Ingredient[] }>('/api/ingredients');
  return response.ingredients;
}

/**
 * Create a new order
 */
export async function createOrder(order: CreateOrderRequest): Promise<CreateOrderResponse> {
  return apiFetch<CreateOrderResponse>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  });
}

/**
 * Get order status by ID
 */
export async function getOrderStatus(orderId: number): Promise<OrderStatusResponse> {
  return apiFetch<OrderStatusResponse>(`/api/orders/${orderId}`);
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
export async function updateOrderStatus(orderId: number, status: string): Promise<{ success: boolean; currentStatus: string }> {
  return apiFetch<{ success: boolean; currentStatus: string }>(`/api/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// ============================================
// Utility Types
// ============================================

export interface AdminOrder {
  id: number;
  bowlSize: number;
  customerName: string | null;
  status: string;
  items: Array<{
    ingredientName: string;
    quantityGrams: number;
    sequenceOrder: number;
  }>;
  totalWeightG: number;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  totalFiberG: number;
  totalPrice: number;
  assignedRobotId: number | null;
  createdAt: string;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ApiIngredientsResponse {
  ingredients: Ingredient[];
}

export interface ApiOrderResponse {
  id: number;
  bowlSize: number;
  customerName: string | null;
  status: string;
  items: Array<{
    ingredientName: string;
    quantityGrams: number;
    sequenceOrder: number;
  }>;
  nutritionalSummary: {
    totalCalories: number;
    totalProteinG: number;
    totalCarbsG: number;
    totalFatG: number;
    totalFiberG: number;
    totalWeightG: number;
  };
  assignedRobotId: number | null;
  createdAt: string;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}
