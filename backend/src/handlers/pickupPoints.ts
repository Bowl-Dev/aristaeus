/**
 * Pickup Point API Handlers
 * GET   /api/pickup-points      - every point, inactive included (public)
 * POST  /api/pickup-points      - create a point (admin, x-admin-token)
 * PATCH /api/pickup-points/{id} - edit any subset of fields (admin, x-admin-token)
 *
 * No delete: checkouts reference points, so they are deactivated instead.
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import { Prisma, type PickupPoint as PickupPointRow } from '@prisma/client';
import { z } from 'zod';
import type { PickupPoint } from '@aristaeus/shared';
import prisma from '../lib/db.js';
import { isAdmin } from '../lib/admin.js';
import {
	success,
	created,
	badRequest,
	notFound,
	unauthorized,
	serverError
} from '../lib/response.js';

const pickupPointSchema = z.object({
	name: z.string().trim().min(1).max(100),
	location: z.string().trim().min(1).max(200),
	hours: z.string().trim().min(1).max(100),
	active: z.boolean(),
	displayOrder: z.number().int().nullable()
});

const toPickupPoint = (point: PickupPointRow): PickupPoint => ({
	id: point.id,
	name: point.name,
	location: point.location,
	hours: point.hours,
	active: point.active,
	displayOrder: point.displayOrder
});

/**
 * GET /api/pickup-points
 */
export const listPickupPoints: APIGatewayProxyHandler = async () => {
	try {
		const points = await prisma.pickupPoint.findMany({
			orderBy: [{ displayOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }]
		});
		return success(points.map(toPickupPoint));
	} catch (error) {
		console.error('Error listing pickup points:', error);
		return serverError('Failed to list pickup points');
	}
};

/**
 * POST /api/pickup-points
 * Body: PickupPointInput -> 201 PickupPoint
 */
export const createPickupPoint: APIGatewayProxyHandler = async (event) => {
	try {
		if (!isAdmin(event)) return unauthorized();
		if (!event.body) return badRequest('Request body is required');

		const parseResult = pickupPointSchema.safeParse(JSON.parse(event.body));
		if (!parseResult.success) return badRequest('Validation failed', parseResult.error.flatten());

		const point = await prisma.pickupPoint.create({ data: parseResult.data });
		return created(toPickupPoint(point));
	} catch (error) {
		console.error('Error creating pickup point:', error);
		return serverError('Failed to create pickup point');
	}
};

/**
 * PATCH /api/pickup-points/{id}
 * Body: Partial<PickupPointInput> -> 200 PickupPoint
 */
export const updatePickupPoint: APIGatewayProxyHandler = async (event) => {
	try {
		if (!isAdmin(event)) return unauthorized();

		const id = parseInt(event.pathParameters?.id ?? '');
		if (isNaN(id)) return badRequest('Invalid pickup point ID');
		if (!event.body) return badRequest('Request body is required');

		const parseResult = pickupPointSchema.partial().safeParse(JSON.parse(event.body));
		if (!parseResult.success) return badRequest('Validation failed', parseResult.error.flatten());

		const point = await prisma.pickupPoint.update({ where: { id }, data: parseResult.data });
		return success(toPickupPoint(point));
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
			return notFound('Pickup point not found');
		}
		console.error('Error updating pickup point:', error);
		return serverError('Failed to update pickup point');
	}
};
