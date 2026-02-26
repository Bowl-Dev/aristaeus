/**
 * User API Handlers
 * GET /api/users/check-phone - Check if phone exists and get user info
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { success, badRequest, notFound, serverError } from '../lib/response.js';

const checkPhoneSchema = z.object({
	phone: z.string().regex(/^(\+57)?[0-9]{10}$/, 'Invalid Colombian phone format')
});

/**
 * GET /api/users/check-phone?phone=+573001234567
 * Check if a user with the given phone number exists
 * Returns user info if found (for returning customer detection)
 */
export const checkPhone: APIGatewayProxyHandler = async (event) => {
	try {
		const phone = event.queryStringParameters?.phone;

		if (!phone) {
			return badRequest('Phone number is required');
		}

		const parseResult = checkPhoneSchema.safeParse({ phone });
		if (!parseResult.success) {
			return badRequest('Validation failed', parseResult.error.flatten());
		}

		const user = await prisma.user.findUnique({
			where: { phone: parseResult.data.phone },
			select: {
				name: true,
				email: true,
				streetAddress: true,
				neighborhood: true,
				city: true,
				department: true,
				postalCode: true
			}
		});

		if (!user) {
			return success({ exists: false });
		}

		return success({
			exists: true,
			user: {
				name: user.name,
				email: user.email,
				address: {
					streetAddress: user.streetAddress,
					neighborhood: user.neighborhood,
					city: user.city,
					department: user.department,
					postalCode: user.postalCode
				}
			}
		});
	} catch (error) {
		console.error('Error checking phone:', error);
		return serverError('Failed to check phone');
	}
};

const deleteUserSchema = z.object({
	phone: z.string().regex(/^(\+57)?[0-9]{10}$/, 'Invalid Colombian phone format')
});

/**
 * DELETE /api/users
 * Deletes user and all associated data
 * Implements Colombian Law 1581 Article 8 right to deletion
 */
export const deleteUser: APIGatewayProxyHandler = async (event) => {
	try {
		if (!event.body) {
			return badRequest('Request body is required');
		}

		const body = JSON.parse(event.body);
		const parseResult = deleteUserSchema.safeParse(body);

		if (!parseResult.success) {
			return badRequest('Validation failed', parseResult.error.flatten());
		}

		const { phone } = parseResult.data;

		// Find user and count their orders
		const user = await prisma.user.findUnique({
			where: { phone },
			include: {
				orders: {
					select: { id: true }
				}
			}
		});

		if (!user) {
			return notFound('No account found with this phone number');
		}

		const ordersCount = user.orders.length;

		// Delete user (orders will cascade delete due to schema configuration)
		await prisma.user.delete({
			where: { phone }
		});

		console.log(`User deleted: ${phone}, Orders deleted: ${ordersCount}`);

		return success({
			success: true,
			message: 'Your data has been permanently deleted',
			ordersDeleted: ordersCount
		});
	} catch (error) {
		console.error('Error deleting user:', error);
		return serverError('Failed to delete user data');
	}
};
