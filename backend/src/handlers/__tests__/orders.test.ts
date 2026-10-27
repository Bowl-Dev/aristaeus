/**
 * Orders Handler Unit Tests
 * listOrders: per-bowl price breakdown for the kitchen view (ENG-104).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

vi.mock('../../lib/db.js', () => ({
	default: {
		order: {
			count: vi.fn(),
			findMany: vi.fn()
		}
	}
}));

import prisma from '../../lib/db.js';
import { listOrders } from '../orders.js';

const event = { queryStringParameters: null } as unknown as APIGatewayProxyEvent;

const dec = (n: number) => ({ toNumber: () => n });

function order(id: number, totalPrice: number, checkout: unknown) {
	return {
		id,
		bowlSize: 450,
		includeCutlery: false,
		user: { id: 'u', name: 'Ana', phone: '3000000000', email: null },
		status: 'pending',
		items: [],
		totalPrice: dec(totalPrice),
		createdAt: new Date('2026-10-26T12:00:00Z'),
		checkout
	};
}

async function list(orders: unknown[]) {
	vi.mocked(prisma.order.count).mockResolvedValue(orders.length);
	vi.mocked(prisma.order.findMany).mockResolvedValue(orders as never);
	const res = (await listOrders(event, {} as Context, () => {})) as APIGatewayProxyResult;
	return JSON.parse(res.body).orders as Array<Record<string, number | null>>;
}

describe('listOrders price breakdown', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('puts delivery and discount on the first bowl only, and the totals sum to checkout.total', async () => {
		// subtotal 60000 + delivery 8000 - discount 5000 = 63000
		const checkout = { orderNumber: 1001, deliveryFee: 8000, discount: 5000, orders: [{ id: 11 }] };
		const rows = await list([
			order(13, 20000, checkout),
			order(12, 25000, checkout),
			order(11, 15000, checkout)
		]);

		const first = rows.find((r) => r.id === 11)!;
		expect(first).toMatchObject({ deliveryFee: 8000, discount: 5000, amountDue: 18000 });
		for (const r of rows.filter((r) => r.id !== 11)) {
			expect(r).toMatchObject({ deliveryFee: 0, discount: 0, amountDue: r.totalPrice });
		}
		expect(rows.reduce((sum, r) => sum + (r.amountDue ?? 0), 0)).toBe(63000);
	});

	it('shows only the bowl price for orders without a checkout', async () => {
		const [row] = await list([order(1, 20000, null)]);
		expect(row).toMatchObject({ deliveryFee: null, discount: null, amountDue: 20000 });
	});
});
