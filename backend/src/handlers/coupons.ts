/**
 * Coupon Admin API Handlers (header `x-admin-token` must equal env ADMIN_TOKEN)
 * GET    /api/coupons      - list coupons, with their redemption counts
 * POST   /api/coupons      - create a coupon
 * PATCH  /api/coupons/{id} - edit any subset of fields (code/type/value lock once redeemed)
 * DELETE /api/coupons/{id} - delete a coupon nobody has redeemed
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

const couponFields = z.object({
	code: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z0-9_-]{3,40}$/, 'Code must be 3-40 letters, digits, _ or -'),
	campaignName: z.string().trim().min(1).max(200),
	description: z.string().max(2000).nullable().optional(),
	type: z.enum(['percent', 'fixed', 'free_shipping']),
	value: z.number().nullable().optional(),
	startsAt: isoDateTime,
	endsAt: isoDateTime,
	budgetTotal: z.number().int().positive(),
	minBowls: z.number().int().min(1),
	firstPurchaseOnly: z.boolean(),
	active: z.boolean()
});

const createCouponSchema = couponFields.superRefine((coupon, ctx) => {
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

/** Validated again merged over the stored coupon, by {@link createCouponSchema}. */
const updateCouponSchema = couponFields.partial();

type CouponWithCount = Coupon & { _count: { checkouts: number } };
const withRedemptions = { _count: { select: { checkouts: true } } } as const;

/** Every column create and update write, except budgetRemaining. */
function toCouponData(data: z.infer<typeof createCouponSchema>) {
	return {
		code: data.code,
		campaignName: data.campaignName,
		description: data.description ?? null,
		type: data.type,
		value: data.value ?? null,
		startsAt: new Date(data.startsAt),
		endsAt: new Date(data.endsAt),
		budgetTotal: data.budgetTotal,
		minBowls: data.minBowls,
		firstPurchaseOnly: data.firstPurchaseOnly,
		active: data.active
	};
}

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

function toCouponRecord(coupon: CouponWithCount): CouponRecord {
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
		createdAt: coupon.createdAt.toISOString(),
		redemptions: coupon._count.checkouts
	};
}

/**
 * GET /api/coupons
 */
export const listCoupons: APIGatewayProxyHandler = async (event) => {
	try {
		if (!isAdmin(event)) return unauthorized();

		const coupons = await prisma.coupon.findMany({
			orderBy: { createdAt: 'desc' },
			include: withRedemptions
		});
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
			data: { ...toCouponData(data), budgetRemaining: data.budgetTotal },
			include: withRedemptions
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
 * Body: UpdateCouponRequest (any subset) -> 200 CouponRecord
 * 409 coupon_in_use: code, type or value changed on a redeemed coupon.
 * A budgetTotal change moves budgetRemaining by the same amount; 400 if that goes below 0.
 */
export const updateCoupon: APIGatewayProxyHandler = async (event) => {
	try {
		if (!isAdmin(event)) return unauthorized();

		const id = parseInt(event.pathParameters?.id ?? '');
		if (isNaN(id)) return badRequest('Invalid coupon ID');
		if (!event.body) return badRequest('Request body is required');

		const patch = updateCouponSchema.safeParse(JSON.parse(event.body));
		if (!patch.success) return badRequest('Validation failed', patch.error.flatten());

		const existing = await prisma.coupon.findUnique({ where: { id }, include: withRedemptions });
		if (!existing) return notFound(`Coupon ${id} not found`);
		const current = toCouponRecord(existing);

		const parseResult = createCouponSchema.safeParse({ ...current, ...patch.data });
		if (!parseResult.success) return badRequest('Validation failed', parseResult.error.flatten());
		const data = parseResult.data;

		if (
			current.redemptions > 0 &&
			(data.code !== current.code ||
				data.type !== current.type ||
				(data.value ?? null) !== current.value)
		) {
			return conflict('coupon_in_use');
		}

		// The guard keeps a budget cut from going below what was already granted,
		// even against a checkout reserving at the same moment.
		const delta = data.budgetTotal - current.budgetTotal;
		const { count } = await prisma.coupon.updateMany({
			where: { id, budgetRemaining: { gte: -delta } },
			data: { ...toCouponData(data), budgetRemaining: { increment: delta } }
		});
		if (count === 0) return badRequest('budget_below_redeemed');

		const coupon = await prisma.coupon.findUniqueOrThrow({
			where: { id },
			include: withRedemptions
		});
		return success(toCouponRecord(coupon));
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			return conflict('coupon_code_taken');
		}
		console.error('Error updating coupon:', error);
		return serverError('Failed to update coupon');
	}
};

/**
 * DELETE /api/coupons/{id}
 * 200 { deleted: true, id }; 409 coupon_in_use once any checkout references it.
 */
export const deleteCoupon: APIGatewayProxyHandler = async (event) => {
	try {
		if (!isAdmin(event)) return unauthorized();

		const id = parseInt(event.pathParameters?.id ?? '');
		if (isNaN(id)) return badRequest('Invalid coupon ID');

		const existing = await prisma.coupon.findUnique({ where: { id }, include: withRedemptions });
		if (!existing) return notFound(`Coupon ${id} not found`);
		if (existing._count.checkouts > 0) return conflict('coupon_in_use');

		await prisma.coupon.delete({ where: { id } });
		return success({ deleted: true, id });
	} catch (error) {
		console.error('Error deleting coupon:', error);
		return serverError('Failed to delete coupon');
	}
};
