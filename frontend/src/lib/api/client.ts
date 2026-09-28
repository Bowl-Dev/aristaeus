/**
 * API Client for Aristaeus Backend
 * Handles all HTTP requests to the AWS Lambda backend
 */

import type {
	Ingredient,
	Menu,
	ListOrdersParams,
	PaginatedOrdersResponse,
	CheckPhoneResponse,
	CheckoutQuoteRequest,
	CheckoutQuote,
	CreateCheckoutRequest,
	CreateCheckoutResponse,
	CheckoutStatusResponse,
	CouponRecord,
	CouponsResponse,
	CreateCouponRequest
} from '$lib/types';

export type { AdminOrder, AdminOrderItem } from '$lib/types';

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

// ============================================
// Checkout (Wompi)
// ============================================

/** Price a cart server-side. Nothing is written; a rejected coupon still answers 200. */
export async function getCheckoutQuote(request: CheckoutQuoteRequest): Promise<CheckoutQuote> {
	return apiFetch<CheckoutQuote>('/api/checkout/quote', {
		method: 'POST',
		body: JSON.stringify(request)
	});
}

/** Create the checkout and its orders; returns the Wompi Web Checkout params. */
export async function createCheckout(
	request: CreateCheckoutRequest
): Promise<CreateCheckoutResponse> {
	return apiFetch<CreateCheckoutResponse>('/api/checkout', {
		method: 'POST',
		body: JSON.stringify(request)
	});
}

/** Payment status of a checkout, for the /order return page. */
export async function getCheckoutStatus(checkoutId: string): Promise<CheckoutStatusResponse> {
	return apiFetch<CheckoutStatusResponse>(`/api/checkout/${encodeURIComponent(checkoutId)}`);
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
 * `street_segment` means the exact address was never found.
 */
export type DeliveryMatchTier =
	| 'exact'
	| 'nearest_number'
	| 'nearest_cross'
	| 'street_segment'
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

export interface DeleteUserResponse {
	success: boolean;
	message: string;
	ordersDeleted: number;
}

// ============================================
// Coupons (admin — every call carries the x-admin-token header)
// ============================================

const adminHeaders = (token: string) => ({ 'x-admin-token': token });

/** List all coupon campaigns. */
export async function listCoupons(token: string): Promise<CouponsResponse> {
	return apiFetch<CouponsResponse>('/api/coupons', { headers: adminHeaders(token) });
}

/** Create a coupon campaign. */
export async function createCoupon(
	coupon: CreateCouponRequest,
	token: string
): Promise<CouponRecord> {
	return apiFetch<CouponRecord>('/api/coupons', {
		method: 'POST',
		headers: adminHeaders(token),
		body: JSON.stringify(coupon)
	});
}

/** Activate or deactivate a coupon — the only edit the API allows. */
export async function updateCoupon(
	id: number,
	patch: { active: boolean },
	token: string
): Promise<CouponRecord> {
	return apiFetch<CouponRecord>(`/api/coupons/${id}`, {
		method: 'PATCH',
		headers: adminHeaders(token),
		body: JSON.stringify(patch)
	});
}
