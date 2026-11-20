/**
 * Store Config API Handlers
 * GET /api/config - ordersPaused + weekly hours
 * PUT /api/config - admin (x-admin-token): update ordersPaused and/or weeklyHours
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
	DEFAULT_WEEKLY_HOURS,
	type StoreConfigResponse,
	type WeeklyHours
} from '@aristaeus/shared';
import prisma from '../lib/db.js';
import { isAdmin } from '../lib/admin.js';
import { success, badRequest, unauthorized, serverError } from '../lib/response.js';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Times are HH:MM');
const range = z
	.tuple([time, time])
	.refine(([start, end]) => start < end, 'A range must end after it starts');
const weeklyHoursSchema = z.record(
	z.enum(['0', '1', '2', '3', '4', '5', '6']),
	z.array(range).max(2)
);

const updateSchema = z
	.object({ ordersPaused: z.boolean(), weeklyHours: weeklyHoursSchema })
	.partial()
	.strict();

/** The singleton row, defaults filled in. Shared with checkout. */
export async function readStoreConfig(): Promise<StoreConfigResponse> {
	const config = await prisma.storeConfig.findFirst();
	return {
		ordersPaused: config?.ordersPaused ?? false,
		weeklyHours: (config?.weeklyHours as WeeklyHours | null) ?? DEFAULT_WEEKLY_HOURS
	};
}

/** GET /api/config */
export const getConfig: APIGatewayProxyHandler = async () => {
	try {
		return success(await readStoreConfig());
	} catch (error) {
		console.error('Error fetching store config:', error);
		return serverError('Failed to fetch store config');
	}
};

/** PUT /api/config (admin) */
export const updateConfig: APIGatewayProxyHandler = async (event) => {
	if (!isAdmin(event)) return unauthorized();
	try {
		if (!event.body) return badRequest('Request body is required');
		const parsed = updateSchema.safeParse(JSON.parse(event.body));
		if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

		const data = parsed.data as { ordersPaused?: boolean; weeklyHours?: Prisma.InputJsonValue };
		await prisma.storeConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
		return success(await readStoreConfig());
	} catch (error) {
		if (error instanceof SyntaxError) return badRequest('Invalid JSON');
		console.error('Error updating store config:', error);
		return serverError('Failed to update store config');
	}
};
