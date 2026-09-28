/**
 * Coupon Admin API Handlers (header `x-admin-token` must equal env ADMIN_TOKEN)
 * GET   /api/coupons      - list coupons
 * POST  /api/coupons      - create a coupon
 * PATCH /api/coupons/{id} - switch a coupon on/off, body { active: boolean }
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from 'aws-lambda';
import { Prisma, type Coupon } from '@prisma/client';
import { z } from 'zod';
import type { CouponRecord, CouponsResponse, CouponType } from '@aristaeus/shared';
import prisma from '../lib/db.js';
import {
	success,
	created,
	badRequest,
	conflict,
	notFound,
	unauthorized,
	serverError
} from '../lib/response.js';

const isoDateTime = z.string().datetime({ offset: true });

const createCouponSchema = z
	.object({
		code: z
			.string()
			.trim()
			.toUpperCase()
			.regex(/^[A-Z0-9_-]{3,40}$/, 'Code must be 3-40 letters, digits, _ or -'),
		campaignName: z.string().trim().min(1).max(200),
		description: z.string().max(2000).optional(),
		type: z.enum(['percent', 'fixed', 'free_shipping']),
		value: z.number().nullable().optional(),
		startsAt: isoDateTime,
		endsAt: isoDateTime,
		budgetTotal: z.number().int().positive(),
		minBowls: z.number().int().min(1),
		firstPurchaseOnly: z.boolean(),
		active: z.boolean()
	})
	.superRefine((coupon, ctx) => {
		const value = coupon.value ?? null;
		const valueError = (message: string) =>
			ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message });

		if (coupon.type === 'percent' && (value === null || value < 1 || value > 100)) {
			valueError('A percent coupon needs a value from 1 to 100');
		}
		if (coupon.type === 'fixed' && (value === null || !Number.isInteger(value) || value <= 0)) {
			valueError('A fixed coupon needs a positive whole COP value');
		}
		if (coupon.type === 'free_shipping' && value !== null) {
			valueError('A free-shipping coupon takes no value');
		}
		if (new Date(coupon.endsAt) <= new Date(coupon.startsAt)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['endsAt'],
				message: 'endsAt must be after startsAt'
			});
		}
	});

const updateCouponSchema = z.object({ active: z.boolean() });

const digest = (text: string) => createHash('sha256').update(text).digest();

/** Timing-safe; hashing first makes both sides the same length. */
function isAdmin(event: APIGatewayProxyEvent): boolean {
	const expected = process.env.ADMIN_TOKEN;
	if (!expected) return false;
	const header = Object.entries(event.headers ?? {}).find(
		([name]) => name.toLowerCase() === 'x-admin-token'
	)?.[1];
	return typeof header === 'string' && timingSafeEqual(digest(header), digest(expected));
}

function toCouponRecord(coupon: Coupon): CouponRecord {
	return {
		id: coupon.id,
		code: coupon.code,
		campaignName: coupon.campaignName,
		description: coupon.description,
		type: coupon.type as CouponType,
		value: coupon.value?.toNumber() ?? null,
		startsAt: coupon.startsAt.toISOString(),
		endsAt: coupon.endsAt.toISOString(),
		budgetTotal: coupon.budgetTotal.toNumber(),
		budgetRemaining: coupon.budgetRemaining.toNumber(),
		minBowls: coupon.minBowls,
		firstPurchaseOnly: coupon.firstPurchaseOnly,
		active: coupon.active,
		createdAt: coupon.createdAt.toISOString()
	};
}

/**
 * GET /api/coupons
 */
export const listCoupons: APIGatewayProxyHandler = async (event) => {
	try {
		if (!isAdmin(event)) return unauthorized();

		const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
		const response: CouponsResponse = {
			coupons: coupons.map(toCouponRecord),
			count: coupons.length
		};
		return success(response);
	} catch (error) {
		console.error('Error listing coupons:', error);
		return serverError('Failed to list coupons');
	}
};

/**
 * POST /api/coupons
 * Body: CreateCouponRequest -> 201 CouponRecord
 */
export const createCoupon: APIGatewayProxyHandler = async (event) => {
	try {
		if (!isAdmin(event)) return unauthorized();
		if (!event.body) return badRequest('Request body is required');

		const parseResult = createCouponSchema.safeParse(JSON.parse(event.body));
		if (!parseResult.success) return badRequest('Validation failed', parseResult.error.flatten());
		const data = parseResult.data;

		const coupon = await prisma.coupon.create({
			data: {
				code: data.code,
				campaignName: data.campaignName,
				description: data.description ?? null,
				type: data.type,
				value: data.value ?? null,
				startsAt: new Date(data.startsAt),
				endsAt: new Date(data.endsAt),
				budgetTotal: data.budgetTotal,
				budgetRemaining: data.budgetTotal,
				minBowls: data.minBowls,
				firstPurchaseOnly: data.firstPurchaseOnly,
				active: data.active
			}
		});
		return created(toCouponRecord(coupon));
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			return conflict('coupon_code_taken');
		}
		console.error('Error creating coupon:', error);
		return serverError('Failed to create coupon');
	}
};

/**
 * PATCH /api/coupons/{id}
 * Body: { active: boolean } -> 200 CouponRecord
 */
export const updateCoupon: APIGatewayProxyHandler = async (event) => {
	try {
		if (!isAdmin(event)) return unauthorized();

		const id = parseInt(event.pathParameters?.id ?? '');
		if (isNaN(id)) return badRequest('Invalid coupon ID');
		if (!event.body) return badRequest('Request body is required');

		const parseResult = updateCouponSchema.safeParse(JSON.parse(event.body));
		if (!parseResult.success) return badRequest('Validation failed', parseResult.error.flatten());

		const existing = await prisma.coupon.findUnique({ where: { id } });
		if (!existing) return notFound(`Coupon ${id} not found`);

		const coupon = await prisma.coupon.update({
			where: { id },
			data: { active: parseResult.data.active }
		});
		return success(toCouponRecord(coupon));
	} catch (error) {
		console.error('Error updating coupon:', error);
		return serverError('Failed to update coupon');
	}
};
