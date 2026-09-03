/**
 * API Client for Aristaeus Backend
 * Handles all HTTP requests to the AWS Lambda backend
 */

import type {
	Ingredient,
	Menu,
	CreateOrderRequest,
	CreateOrderResponse,
	OrderStatusResponse,
	ColombianAddress
} from '@aristaeus/shared';

// API base URL - configured via environment variable.
// In development: http://localhost:3000
// In production: an empty string. CloudFront proxies /api/* to API Gateway on the
// same origin, so every endpoint below is already a complete path.
// Use ?? and not ||, because an empty string is falsy and || would select the
// localhost default in a production build.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

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
 * Fetch runtime configuration (e.g. whether ordering is paused)
 */
export async function getConfig(): Promise<{ ordersPaused: boolean }> {
	return apiFetch('/api/config');
}

/**
 * Fetch all available ingredients
 */
export async function getIngredients(): Promise<Ingredient[]> {
	const response = await apiFetch<{ ingredients: Ingredient[] }>('/api/ingredients');
	return response.ingredients;
}

/**
 * Fetch all active menus with their ingredients
 */
export async function getMenus(): Promise<Menu[]> {
	const response = await apiFetch<{ menus: Menu[] }>('/api/menus');
	return response.menus;
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

/**
 * Delete user data by phone number
 * Implements Colombian Law 1581 right to deletion
 */
export async function deleteUserData(phone: string): Promise<DeleteUserResponse> {
	return apiFetch<DeleteUserResponse>('/api/users', {
		method: 'DELETE',
		body: JSON.stringify({ phone })
	});
}

// ============================================
// Delivery estimation (admin/ops only)
// ============================================

/**
 * Estimate the courier fee for a free-text Bogota address.
 * The server geocodes it against the cadastral service and prices the result.
 */
export async function estimateDelivery(address: string): Promise<DeliveryEstimateResponse> {
	return apiFetch<DeliveryEstimateResponse>('/api/delivery/estimate', {
		method: 'POST',
		body: JSON.stringify({ address })
	});
}

/**
 * List the recorded courier charges the model is fitted on, together with the
 * fitted parameters and the cross-validated accuracy figure.
 */
export async function listDeliveryObservations(): Promise<DeliveryObservationsResponse> {
	return apiFetch<DeliveryObservationsResponse>('/api/delivery/observations');
}

/**
 * Record what a courier actually charged. This is how the model improves, and
 * unlike the old localStorage store it is shared across every operator.
 */
export async function createDeliveryObservation(
	observation: CreateDeliveryObservationRequest
): Promise<DeliveryObservationCreated> {
	return apiFetch<DeliveryObservationCreated>('/api/delivery/observations', {
		method: 'POST',
		body: JSON.stringify(observation)
	});
}

/**
 * Remove a recorded courier charge (a mistyped price, say).
 */
export async function deleteDeliveryObservation(
	id: number
): Promise<{ deleted: boolean; id: number }> {
	return apiFetch<{ deleted: boolean; id: number }>(`/api/delivery/observations/${id}`, {
		method: 'DELETE'
	});
}

// ============================================
// Utility Types
// ============================================

/**
 * How the address was located in the cadastre, in descending order of trust.
 * `street_segment` and `grid_fallback` mean the exact address was never found.
 */
export type DeliveryMatchTier =
	| 'exact'
	| 'nearest_number'
	| 'nearest_cross'
	| 'street_segment'
	| 'grid_fallback'
	| 'failed';

export type DeliveryConfidence = 'high' | 'good' | 'medium' | 'low';

export interface DeliveryEstimateFigures {
	/** Estimated cost in COP, rounded to the nearest 100. */
	cost: number;
	northKm: number;
	eastKm: number;
	totalKm: number;
	/** True when the raw estimate fell below the minimum fare and was clamped. */
	minFareApplied: boolean;
}

export interface DeliveryEstimateResponse {
	/** Null only when neither the cadastre nor the grid fallback could place the address. */
	estimate: DeliveryEstimateFigures | null;
	matchTier: DeliveryMatchTier;
	confidence: DeliveryConfidence;
	/** True when the geocode search ran out of its time budget — retry is cheap and better. */
	searchTruncated: boolean;
	/** The cadastral plate actually matched, e.g. "AC 26 43 89". Null on the fallback paths. */
	resolvedPlate?: string | null;
	coordinates?: { lat: number; lng: number } | null;
	cached?: boolean;
	/** Leave-one-out cross-validated MAE in COP. Null when it does not apply. */
	accuracyCop?: number | null;
	observationCount?: number;
	/** The parsed address, normalised the way it is written in Colombia. */
	address: string;
	/** Present only when the server needs to explain a degraded result. */
	message?: string;
}

export interface DeliveryModelParams {
	intercept: number;
	ratePerKmNS: number;
	ratePerKmEW: number;
	minFare: number;
}

export interface DeliveryObservationRecord {
	id: number;
	rawAddress: string;
	prefix: string;
	street: string;
	cross: string;
	number: number;
	lat: number | null;
	lng: number | null;
	matchTier: string;
	northKm: number | null;
	eastKm: number | null;
	actualCost: number;
	source: string;
	recordedAt: string;
}

export interface DeliveryObservationsResponse {
	observations: DeliveryObservationRecord[];
	count: number;
	accuracyCop: number | null;
	model: DeliveryModelParams;
}

export interface CreateDeliveryObservationRequest {
	address: string;
	actualCost: number;
	source?: 'seed' | 'correction';
}

export interface DeliveryObservationCreated {
	id: number;
	rawAddress: string;
	lat: number | null;
	lng: number | null;
	matchTier: string;
	northKm: number | null;
	eastKm: number | null;
	actualCost: number;
	source: string;
	recordedAt: string;
}

export interface AdminOrderUser {
	id: string;
	name: string;
	phone: string;
	email: string | null;
	address: ColombianAddress;
}

export interface AdminOrderItem {
	ingredientName: string;
	ingredientNameEs: string;
	ingredientNameEn: string;
	ingredientCategory: string;
	quantityGrams: number;
	sequenceOrder: number;
}

export interface AdminOrder {
	id: number;
	bowlSize: number;
	includeCutlery: boolean;
	user: AdminOrderUser;
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
		ingredientNameEs: string;
		ingredientNameEn: string;
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

export interface DeleteUserResponse {
	success: boolean;
	message: string;
	ordersDeleted: number;
}
