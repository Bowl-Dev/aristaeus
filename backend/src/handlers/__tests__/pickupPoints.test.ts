import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Prisma } from '@prisma/client';

vi.mock('../../lib/db.js', () => ({
	default: { pickupPoint: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() } }
}));

import prisma from '../../lib/db.js';
import { listPickupPoints, createPickupPoint, updatePickupPoint } from '../pickupPoints.js';

async function call(
	handler: typeof listPickupPoints,
	headers: Record<string, string>,
	body?: unknown,
	id?: string
): Promise<APIGatewayProxyResult> {
	const event = {
		headers,
		pathParameters: id === undefined ? null : { id },
		body: body === undefined ? null : JSON.stringify(body)
	} as unknown as APIGatewayProxyEvent;
	return (await handler(event, {} as Context, () => {})) as APIGatewayProxyResult;
}

const admin = { 'x-admin-token': 'secret-token' };
const input = {
	name: 'UNAL',
	location: 'Facultad de Medicina',
	hours: 'Lunes a viernes, 11am – 2pm',
	active: true,
	displayOrder: 1
};
const row = { id: 1, ...input, createdAt: new Date(), updatedAt: new Date() };

describe('pickup point handlers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.ADMIN_TOKEN = 'secret-token';
	});

	it('lists every point publicly, without timestamps', async () => {
		vi.mocked(prisma.pickupPoint.findMany).mockResolvedValue([row] as never);

		const response = await call(listPickupPoints, {});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toEqual([{ id: 1, ...input }]);
	});

	it('requires the admin token to create or update', async () => {
		expect((await call(createPickupPoint, {}, input)).statusCode).toBe(401);
		expect((await call(updatePickupPoint, { 'x-admin-token': 'no' }, {}, '1')).statusCode).toBe(
			401
		);
		expect(prisma.pickupPoint.create).not.toHaveBeenCalled();
		expect(prisma.pickupPoint.update).not.toHaveBeenCalled();
	});

	it('creates a point', async () => {
		vi.mocked(prisma.pickupPoint.create).mockResolvedValue(row as never);

		const response = await call(createPickupPoint, admin, input);

		expect(response.statusCode).toBe(201);
		expect(prisma.pickupPoint.create).toHaveBeenCalledWith({ data: input });
	});

	it('validates the body', async () => {
		const response = await call(createPickupPoint, admin, { ...input, name: '' });

		expect(response.statusCode).toBe(400);
	});

	it('toggles active, 404 for a missing point', async () => {
		vi.mocked(prisma.pickupPoint.update).mockResolvedValueOnce({ ...row, active: false } as never);
		const toggled = await call(updatePickupPoint, admin, { active: false }, '1');
		vi.mocked(prisma.pickupPoint.update).mockRejectedValueOnce(
			new Prisma.PrismaClientKnownRequestError('Not found', {
				code: 'P2025',
				clientVersion: 'test'
			})
		);
		const missing = await call(updatePickupPoint, admin, { active: false }, '99');

		expect(toggled.statusCode).toBe(200);
		expect(JSON.parse(toggled.body)).toMatchObject({ active: false });
		expect(prisma.pickupPoint.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { active: false }
		});
		expect(missing.statusCode).toBe(404);
	});
});
