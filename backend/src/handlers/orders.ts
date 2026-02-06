/**
 * Orders API Handlers
 * GET /api/orders - List all orders (admin)
 * POST /api/orders - Create a new order
 * GET /api/orders/{id} - Get order details
 * POST /api/orders/{orderId}/status - Update order status (robot API)
 * PUT /api/orders/{orderId}/status - Update order status (admin API)
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { success, created, badRequest, notFound, serverError, conflict } from '../lib/response.js';
import { calculateNutrition } from '../lib/nutrition.js';

// Validation schemas
const VALID_BOWL_SIZES = [250, 450, 600] as const;
const MIN_QUANTITY_GRAMS = 10;

// Colombian address validation schema
const colombianAddressSchema = z.object({
	streetAddress: z
		.string()
		.min(5, 'Street address must be at least 5 characters')
		.max(200, 'Street address cannot exceed 200 characters'),
	neighborhood: z
		.string()
		.min(2, 'Neighborhood must be at least 2 characters')
		.max(100, 'Neighborhood cannot exceed 100 characters'),
	city: z
		.string()
		.min(2, 'City must be at least 2 characters')
		.max(100, 'City cannot exceed 100 characters'),
	department: z
		.string()
		.min(2, 'Department must be at least 2 characters')
		.max(100, 'Department cannot exceed 100 characters'),
	postalCode: z
		.string()
		.regex(/^[0-9]{6}$/, 'Postal code must be exactly 6 digits')
		.optional()
});

// Customer information validation schema
const customerSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
	phone: z
		.string()
		.regex(/^(\+57)?[0-9]{10}$/, 'Invalid Colombian phone format. Use +57XXXXXXXXXX or 10 digits'),
	email: z.string().email('Invalid email format').max(255).optional(),
	address: colombianAddressSchema
});

const createOrderSchema = z.object({
	bowlSize: z.number().refine((val) => VALID_BOWL_SIZES.includes(val as 250 | 450 | 600), {
		message: 'Bowl size must be 250, 450, or 600 grams'
	}),
	customer: customerSchema,
	items: z
		.array(
			z.object({
				ingredientId: z.number().int().positive(),
				quantityGrams: z.number().min(MIN_QUANTITY_GRAMS)
			})
		)
		.min(1, 'Order must contain at least one item')
});

const updateStatusSchema = z.object({
	robotId: z.number().int().positive(),
	status: z.enum(['preparing', 'ready', 'completed', 'failed'])
});

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

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
	assigned: ['preparing'],
	preparing: ['ready', 'failed'],
	ready: ['completed']
};

/**
 * POST /api/orders
 * Creates a new bowl order
 */
export const createOrder: APIGatewayProxyHandler = async (event) => {
	try {
		if (!event.body) {
			return badRequest('Request body is required');
		}

		const body = JSON.parse(event.body);
		const parseResult = createOrderSchema.safeParse(body);

		if (!parseResult.success) {
			return badRequest('Validation failed', parseResult.error.flatten());
		}

		const { bowlSize, customer, items } = parseResult.data;

		// Fetch all ingredients for validation and calculation
		const ingredientIds = items.map((item) => item.ingredientId);
		const ingredients = await prisma.ingredient.findMany({
			where: {
				id: { in: ingredientIds },
				available: true
			}
		});

		// Validate all ingredients exist and are available
		if (ingredients.length !== ingredientIds.length) {
			const foundIds = new Set(ingredients.map((i) => i.id));
			const missingIds = ingredientIds.filter((id) => !foundIds.has(id));
			return badRequest(`Ingredients not found or unavailable: ${missingIds.join(', ')}`);
		}

		// Create ingredient map for calculations
		const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));

		// Calculate nutritional summary (server-side validation)
		const nutrition = calculateNutrition(items, ingredientMap);

		// Validate total weight doesn't exceed bowl size
		if (nutrition.totalWeightG > bowlSize) {
			return badRequest(
				`Total weight (${nutrition.totalWeightG}g) exceeds bowl capacity (${bowlSize}g)`
			);
		}

		// Create order with user and items in a transaction
		const order = await prisma.$transaction(async (tx) => {
			// Find or create user by phone number (upsert)
			const user = await tx.user.upsert({
				where: { phone: customer.phone },
				update: {
					name: customer.name,
					email: customer.email ?? null,
					streetAddress: customer.address.streetAddress,
					neighborhood: customer.address.neighborhood,
					city: customer.address.city,
					department: customer.address.department,
					postalCode: customer.address.postalCode ?? null
				},
				create: {
					name: customer.name,
					phone: customer.phone,
					email: customer.email ?? null,
					streetAddress: customer.address.streetAddress,
					neighborhood: customer.address.neighborhood,
					city: customer.address.city,
					department: customer.address.department,
					postalCode: customer.address.postalCode ?? null
				}
			});

			// Create the order linked to user
			const newOrder = await tx.order.create({
				data: {
					userId: user.id,
					bowlSize,
					status: 'pending',
					totalCalories: nutrition.totalCalories,
					totalProteinG: nutrition.totalProteinG,
					totalCarbsG: nutrition.totalCarbsG,
					totalFatG: nutrition.totalFatG,
					totalFiberG: nutrition.totalFiberG,
					totalWeightG: nutrition.totalWeightG,
					totalPrice: nutrition.totalPrice
				}
			});

			// Create order items
			await tx.orderItem.createMany({
				data: items.map((item, index) => ({
					orderId: newOrder.id,
					ingredientId: item.ingredientId,
					quantityGrams: item.quantityGrams,
					sequenceOrder: index + 1
				}))
			});

			return newOrder;
		});

		// Try to assign to an available robot
		const assignedOrder = await tryAssignRobot(order.id);

		return created({
			orderId: order.id,
			status: assignedOrder?.status ?? order.status,
			createdAt: order.createdAt.toISOString()
		});
	} catch (error) {
		console.error('Error creating order:', error);
		return serverError('Failed to create order');
	}
};

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
							select: { name: true }
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
					streetAddress: order.user.streetAddress,
					neighborhood: order.user.neighborhood,
					city: order.user.city,
					department: order.user.department,
					postalCode: order.user.postalCode
				}
			},
			status: order.status,
			items: order.items.map((item) => ({
				ingredientName: item.ingredient.name,
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
			assignedRobotId: order.assignedRobotId,
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
 * List all orders (admin view)
 */
export const listOrders: APIGatewayProxyHandler = async () => {
	try {
		const orders = await prisma.order.findMany({
			include: {
				user: true,
				items: {
					include: {
						ingredient: {
							select: { name: true }
						}
					},
					orderBy: { sequenceOrder: 'asc' }
				}
			},
			orderBy: { createdAt: 'desc' }
		});

		return success({
			orders: orders.map((order) => ({
				id: order.id,
				bowlSize: order.bowlSize,
				user: {
					id: order.user.id,
					name: order.user.name,
					phone: order.user.phone,
					email: order.user.email,
					address: {
						streetAddress: order.user.streetAddress,
						neighborhood: order.user.neighborhood,
						city: order.user.city,
						department: order.user.department,
						postalCode: order.user.postalCode
					}
				},
				status: order.status,
				items: order.items.map((item) => ({
					ingredientName: item.ingredient.name,
					quantityGrams: item.quantityGrams.toNumber(),
					sequenceOrder: item.sequenceOrder
				})),
				totalWeightG: order.totalWeightG?.toNumber() ?? 0,
				totalCalories: order.totalCalories?.toNumber() ?? 0,
				totalProteinG: order.totalProteinG?.toNumber() ?? 0,
				totalCarbsG: order.totalCarbsG?.toNumber() ?? 0,
				totalFatG: order.totalFatG?.toNumber() ?? 0,
				totalFiberG: order.totalFiberG?.toNumber() ?? 0,
				totalPrice: order.totalPrice?.toNumber() ?? 0,
				assignedRobotId: order.assignedRobotId,
				createdAt: order.createdAt.toISOString(),
				assignedAt: order.assignedAt?.toISOString() ?? null,
				startedAt: order.startedAt?.toISOString() ?? null,
				completedAt: order.completedAt?.toISOString() ?? null
			}))
		});
	} catch (error) {
		console.error('Error listing orders:', error);
		return serverError('Failed to list orders');
	}
};

/**
 * PUT /api/orders/{orderId}/status
 * Admin updates order status (no robot restrictions)
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
			assignedRobotId?: number | null;
		} = { status };

		// Set timestamps based on status
		if (status === 'preparing' && !order.startedAt) {
			updateData.startedAt = new Date();
		} else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
			updateData.completedAt = new Date();
			// Free the robot if assigned
			if (order.assignedRobotId) {
				await prisma.robot.update({
					where: { id: order.assignedRobotId },
					data: {
						currentOrderId: null,
						status: 'online'
					}
				});
			}
		} else if (status === 'pending') {
			// Reset timestamps when going back to pending
			updateData.startedAt = null;
			updateData.completedAt = null;
			updateData.assignedAt = null;
			updateData.assignedRobotId = null;
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

/**
 * POST /api/orders/{orderId}/status
 * Robot updates order status
 */
export const updateOrderStatus: APIGatewayProxyHandler = async (event) => {
	try {
		const orderId = parseInt(event.pathParameters?.orderId ?? '');

		if (isNaN(orderId)) {
			return badRequest('Invalid order ID');
		}

		if (!event.body) {
			return badRequest('Request body is required');
		}

		const body = JSON.parse(event.body);
		const parseResult = updateStatusSchema.safeParse(body);

		if (!parseResult.success) {
			return badRequest('Validation failed', parseResult.error.flatten());
		}

		const { robotId, status } = parseResult.data;

		// Get current order
		const order = await prisma.order.findUnique({
			where: { id: orderId }
		});

		if (!order) {
			return notFound(`Order ${orderId} not found`);
		}

		// Validate robot is assigned to this order
		if (order.assignedRobotId !== robotId) {
			return conflict(`Robot ${robotId} is not assigned to order ${orderId}`);
		}

		// Validate status transition
		const allowedTransitions = STATUS_TRANSITIONS[order.status] ?? [];
		if (!allowedTransitions.includes(status)) {
			return badRequest(
				`Invalid status transition: ${order.status} -> ${status}. Allowed: ${allowedTransitions.join(', ')}`
			);
		}

		// Build update data based on new status
		const updateData: {
			status: string;
			startedAt?: Date;
			completedAt?: Date;
		} = { status };

		if (status === 'preparing') {
			updateData.startedAt = new Date();
		} else if (status === 'completed' || status === 'failed') {
			updateData.completedAt = new Date();
		}

		// Update order and potentially free the robot
		await prisma.$transaction(async (tx) => {
			await tx.order.update({
				where: { id: orderId },
				data: updateData
			});

			// If order is terminal, free the robot
			if (status === 'completed' || status === 'failed') {
				await tx.robot.update({
					where: { id: robotId },
					data: {
						currentOrderId: null,
						status: 'online'
					}
				});
			}
		});

		return success({
			success: true,
			currentStatus: status
		});
	} catch (error) {
		console.error('Error updating order status:', error);
		return serverError('Failed to update order status');
	}
};

/**
 * Try to assign an order to an available robot
 */
async function tryAssignRobot(orderId: number) {
	try {
		// Find available robot
		const availableRobot = await prisma.robot.findFirst({
			where: {
				status: 'online',
				currentOrderId: null
			},
			orderBy: {
				lastHeartbeat: 'desc'
			}
		});

		if (!availableRobot) {
			return null;
		}

		// Assign order to robot in a transaction
		const updatedOrder = await prisma.$transaction(async (tx) => {
			const order = await tx.order.update({
				where: { id: orderId },
				data: {
					status: 'queued',
					assignedRobotId: availableRobot.id,
					assignedAt: new Date()
				}
			});

			await tx.robot.update({
				where: { id: availableRobot.id },
				data: {
					currentOrderId: orderId,
					status: 'busy'
				}
			});

			return order;
		});

		return updatedOrder;
	} catch (error) {
		console.error('Error assigning robot:', error);
		return null;
	}
}
