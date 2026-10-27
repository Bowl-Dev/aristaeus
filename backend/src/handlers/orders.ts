/**
 * Orders API Handlers
 * GET /api/orders - List all orders (admin)
 * GET /api/orders/{id} - Get order details
 * PUT /api/orders/{orderId}/status - Update order status (admin API)
 *
 * Orders are created by POST /api/checkout (see checkout.ts).
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { success, badRequest, notFound, serverError } from '../lib/response.js';

const adminUpdateStatusSchema = z.object({
	status: z.enum([
		'pending',
		'queued',
		'assigned',
		'preparing',
		'ready',
		'completed',
		'cancelled',
		'failed'
	])
});

/**
 * GET /api/orders/{id}
 * Get order details and status
 */
export const getOrder: APIGatewayProxyHandler = async (event) => {
	try {
		const orderId = parseInt(event.pathParameters?.id ?? '');

		if (isNaN(orderId)) {
			return badRequest('Invalid order ID');
		}

		const order = await prisma.order.findUnique({
			where: { id: orderId },
			include: {
				user: true,
				items: {
					include: {
						ingredient: {
							select: { name: true, nameEs: true, nameEn: true }
						}
					},
					orderBy: { sequenceOrder: 'asc' }
				}
			}
		});

		if (!order) {
			return notFound(`Order ${orderId} not found`);
		}

		return success({
			id: order.id,
			bowlSize: order.bowlSize,
			user: {
				id: order.user.id,
				name: order.user.name,
				phone: order.user.phone,
				email: order.user.email,
				address: {
					streetAddress: order.deliveryStreetAddress,
					neighborhood: order.deliveryNeighborhood,
					city: order.deliveryCity,
					department: order.deliveryDepartment,
					postalCode: order.deliveryPostalCode
				}
			},
			deliveryInstructions: order.deliveryInstructions,
			status: order.status,
			items: order.items.map((item) => ({
				ingredientName: item.ingredient.name,
				ingredientNameEs: item.ingredient.nameEs,
				ingredientNameEn: item.ingredient.nameEn,
				quantityGrams: item.quantityGrams.toNumber(),
				sequenceOrder: item.sequenceOrder
			})),
			nutritionalSummary: {
				totalCalories: order.totalCalories?.toNumber() ?? 0,
				totalProteinG: order.totalProteinG?.toNumber() ?? 0,
				totalCarbsG: order.totalCarbsG?.toNumber() ?? 0,
				totalFatG: order.totalFatG?.toNumber() ?? 0,
				totalFiberG: order.totalFiberG?.toNumber() ?? 0,
				totalWeightG: order.totalWeightG?.toNumber() ?? 0,
				totalPrice: order.totalPrice?.toNumber() ?? 0
			},
			createdAt: order.createdAt.toISOString(),
			assignedAt: order.assignedAt?.toISOString() ?? null,
			startedAt: order.startedAt?.toISOString() ?? null,
			completedAt: order.completedAt?.toISOString() ?? null
		});
	} catch (error) {
		console.error('Error fetching order:', error);
		return serverError('Failed to fetch order');
	}
};

/**
 * GET /api/orders
 * List all orders (admin view) with pagination and filtering
 */
export const listOrders: APIGatewayProxyHandler = async (event) => {
	try {
		// Parse query parameters for pagination and filtering
		const queryParams = event.queryStringParameters || {};
		const status = queryParams.status || 'all';
		const limit = Math.min(Math.max(parseInt(queryParams.limit || '20', 10), 1), 100);
		const offset = Math.max(parseInt(queryParams.offset || '0', 10), 0);

		// Build where clause for status filtering
		const where = status !== 'all' ? { status } : {};

		// Get total count for pagination
		const total = await prisma.order.count({ where });

		const orders = await prisma.order.findMany({
			where,
			include: {
				user: true,
				checkout: {
					select: {
						orderNumber: true,
						deliveryFee: true,
						discount: true,
						// The checkout's first bowl carries its delivery fee and discount
						orders: {
							select: { id: true },
							orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
							take: 1
						}
					}
				},
				items: {
					include: {
						ingredient: {
							select: { name: true, nameEs: true, nameEn: true, category: true }
						}
					},
					orderBy: { sequenceOrder: 'asc' }
				}
			},
			orderBy: { createdAt: 'desc' },
			take: limit,
			skip: offset
		});

		return success({
			orders: orders.map((order) => {
				const totalPrice = order.totalPrice?.toNumber() ?? 0;
				const isFirstBowl = order.checkout?.orders[0]?.id === order.id;
				const deliveryFee = order.checkout ? (isFirstBowl ? order.checkout.deliveryFee : 0) : null;
				const discount = order.checkout ? (isFirstBowl ? order.checkout.discount : 0) : null;
				return {
					id: order.id,
					orderNumber: order.checkout?.orderNumber ?? null,
					bowlSize: order.bowlSize,
					includeCutlery: order.includeCutlery,
					user: {
						id: order.user.id,
						name: order.user.name,
						phone: order.user.phone,
						email: order.user.email,
						address: {
							streetAddress: order.deliveryStreetAddress,
							neighborhood: order.deliveryNeighborhood,
							city: order.deliveryCity,
							department: order.deliveryDepartment,
							postalCode: order.deliveryPostalCode
						}
					},
					deliveryInstructions: order.deliveryInstructions,
					status: order.status,
					items: order.items.map((item) => ({
						ingredientName: item.ingredient.name,
						ingredientNameEs: item.ingredient.nameEs,
						ingredientNameEn: item.ingredient.nameEn,
						ingredientCategory: item.ingredient.category,
						quantityGrams: item.quantityGrams.toNumber(),
						sequenceOrder: item.sequenceOrder
					})),
					totalWeightG: order.totalWeightG?.toNumber() ?? 0,
					totalCalories: order.totalCalories?.toNumber() ?? 0,
					totalProteinG: order.totalProteinG?.toNumber() ?? 0,
					totalCarbsG: order.totalCarbsG?.toNumber() ?? 0,
					totalFatG: order.totalFatG?.toNumber() ?? 0,
					totalFiberG: order.totalFiberG?.toNumber() ?? 0,
					totalPrice,
					deliveryFee,
					discount,
					amountDue: totalPrice + (deliveryFee ?? 0) - (discount ?? 0),
					createdAt: order.createdAt.toISOString(),
					assignedAt: order.assignedAt?.toISOString() ?? null,
					startedAt: order.startedAt?.toISOString() ?? null,
					completedAt: order.completedAt?.toISOString() ?? null
				};
			}),
			total,
			limit,
			offset
		});
	} catch (error) {
		console.error('Error listing orders:', error);
		return serverError('Failed to list orders');
	}
};

/**
 * PUT /api/orders/{orderId}/status
 * Admin updates order status
 */
export const adminUpdateOrderStatus: APIGatewayProxyHandler = async (event) => {
	try {
		const orderId = parseInt(event.pathParameters?.orderId ?? '');

		if (isNaN(orderId)) {
			return badRequest('Invalid order ID');
		}

		if (!event.body) {
			return badRequest('Request body is required');
		}

		const body = JSON.parse(event.body);
		const parseResult = adminUpdateStatusSchema.safeParse(body);

		if (!parseResult.success) {
			return badRequest('Validation failed', parseResult.error.flatten());
		}

		const { status } = parseResult.data;

		// Get current order
		const order = await prisma.order.findUnique({
			where: { id: orderId }
		});

		if (!order) {
			return notFound(`Order ${orderId} not found`);
		}

		// Build update data based on new status
		const updateData: {
			status: string;
			startedAt?: Date | null;
			completedAt?: Date | null;
			assignedAt?: Date | null;
		} = { status };

		// Set timestamps based on status
		if (status === 'preparing' && !order.startedAt) {
			updateData.startedAt = new Date();
		} else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
			updateData.completedAt = new Date();
		} else if (status === 'pending') {
			// Reset timestamps when going back to pending
			updateData.startedAt = null;
			updateData.completedAt = null;
			updateData.assignedAt = null;
		}

		await prisma.order.update({
			where: { id: orderId },
			data: updateData
		});

		return success({
			success: true,
			orderId,
			currentStatus: status
		});
	} catch (error) {
		console.error('Error updating order status:', error);
		return serverError('Failed to update order status');
	}
};
