/**
 * API Client for Aristaeus Backend
 * Handles all HTTP requests to the AWS Lambda backend
 */

import type {
	Ingredient,
	CreateOrderRequest,
	CreateOrderResponse,
	OrderStatusResponse,
	ColombianAddress
} from '@aristaeus/shared';

// API base URL - configured via environment variable
// In development: http://localhost:3000
// In production: Your API Gateway URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const url = `${API_BASE_URL}${endpoint}`;

	const response = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options.headers
		}
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
		body: JSON.stringify(order)
	});
}

/**
 * Get order status by ID
 */
export async function getOrderStatus(orderId: number): Promise<OrderStatusResponse> {
	return apiFetch<OrderStatusResponse>(`/api/orders/${orderId}`);
}

/**
 * List all orders (admin) with optional pagination and filtering
 */
export async function listOrders(params: ListOrdersParams = {}): Promise<PaginatedOrdersResponse> {
	const searchParams = new URLSearchParams();

	if (params.status && params.status !== 'all') {
		searchParams.set('status', params.status);
	}
	if (params.limit !== undefined) {
		searchParams.set('limit', params.limit.toString());
	}
	if (params.offset !== undefined) {
		searchParams.set('offset', params.offset.toString());
	}

	const query = searchParams.toString();
	const endpoint = query ? `/api/orders?${query}` : '/api/orders';

	return apiFetch<PaginatedOrdersResponse>(endpoint);
}

/**
 * Update order status (admin)
 */
export async function updateOrderStatus(
	orderId: number,
	status: string
): Promise<{ success: boolean; currentStatus: string }> {
	return apiFetch<{ success: boolean; currentStatus: string }>(`/api/orders/${orderId}/status`, {
		method: 'PUT',
		body: JSON.stringify({ status })
	});
}

/**
 * Check if a phone number exists (returning customer detection)
 */
export async function checkPhone(phone: string): Promise<CheckPhoneResponse> {
	return apiFetch<CheckPhoneResponse>(`/api/users/check-phone?phone=${encodeURIComponent(phone)}`);
}

// ============================================
// Utility Types
// ============================================

export interface AdminOrderUser {
	id: string;
	name: string;
	phone: string;
	email: string | null;
	address: ColombianAddress;
}

export interface AdminOrderItem {
	ingredientName: string;
	ingredientCategory: string;
	quantityGrams: number;
	sequenceOrder: number;
}

export interface AdminOrder {
	id: number;
	bowlSize: number;
	includeCutlery: boolean;
	user: AdminOrderUser;
	status: string;
	items: AdminOrderItem[];
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

export interface ListOrdersParams {
	status?: string;
	limit?: number;
	offset?: number;
}

export interface PaginatedOrdersResponse {
	orders: AdminOrder[];
	total: number;
	limit: number;
	offset: number;
}

export interface CheckPhoneResponse {
	exists: boolean;
	user?: {
		name: string;
		email: string | null;
		address: ColombianAddress;
	};
}

export interface ApiIngredientsResponse {
	ingredients: Ingredient[];
}

export interface ApiOrderResponse {
	id: number;
	bowlSize: number;
	user: AdminOrderUser;
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
