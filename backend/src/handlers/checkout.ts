/**
 * Checkout API Handlers
 * POST /api/checkout/quote - price a cart (no writes)
 * POST /api/checkout       - create the checkout + its orders
 * GET  /api/checkout/{id}  - checkout status
 *
 * No in-app payment yet: orders go straight to `pending` (the kitchen queue)
 * and the checkout is `not_required`.
 */

import type { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import type { Coupon } from '@prisma/client';
import { z } from 'zod';
import type {
	CheckoutQuote,
	CheckoutStatusResponse,
	CouponType,
	CreateCheckoutResponse,
	PaymentStatus
} from '@aristaeus/shared';
import prisma from '../lib/db.js';
import {
	success,
	created,
	badRequest,
	conflict,
	notFound,
	serverError,
	serviceUnavailable
} from '../lib/response.js';
import { priceBowl, computeTotals } from '../lib/pricing.js';
import { getDeliveryFee } from '../lib/delivery/estimate.js';
import { evaluateCoupon, reserveBudget } from '../lib/coupons.js';

const MIN_QUANTITY_GRAMS = 5;

/** Normalized to the 10 local digits, so +573001234567 and 3001234567 are one user. */
const phoneSchema = z
	.string()
	.regex(/^(\+57)?[0-9]{10}$/, 'Invalid Colombian phone format. Use +57XXXXXXXXXX or 10 digits')
	.transform((phone) => phone.slice(-10));

const bowlSchema = z.object({
	bowlSize: z.union([z.literal(250), z.literal(450), z.literal(600)]),
	items: z
		.array(
			z.object({
				ingredientId: z.number().int().positive(),
				quantityGrams: z.number().min(MIN_QUANTITY_GRAMS)
			})
		)
		.min(1, 'A bowl must contain at least one item'),
	includeCutlery: z.boolean(),
	quantity: z.number().int().min(1).max(10)
});

const quoteSchema = z.object({
	address: z.string().trim().min(5).max(200),
	bowls: z.array(bowlSchema).min(1).max(10),
	couponCode: z.string().max(40).optional(),
	phone: phoneSchema.optional()
});

const createSchema = quoteSchema.extend({
	customer: z.object({ name: z.string().trim().min(1).max(100), phone: phoneSchema }),
	deliveryInstructions: z.string().max(500).optional()
});

type Cart = z.infer<typeof quoteSchema>;

/** Checkout takes a free-form Bogotá address; the structured fields get these. */
const BOGOTA = { neighborhood: 'Bogotá', city: 'Bogotá', department: 'Bogotá D.C.' };

class BudgetTaken extends Error {}

/**
 * Price a cart exactly as it will be charged. Returns an error response when
 * it cannot be priced (bad ingredients, overweight bowl, unpriceable address).
 */
async function priceCart(cart: Cart, phone: string | undefined) {
	const ids = [...new Set(cart.bowls.flatMap((bowl) => bowl.items.map((i) => i.ingredientId)))];
	const ingredients = await prisma.ingredient.findMany({
		where: { id: { in: ids }, available: true }
	});
	if (ingredients.length !== ids.length) {
		const found = new Set(ingredients.map((i) => i.id));
		return badRequest(
			`Ingredients not found or unavailable: ${ids.filter((id) => !found.has(id)).join(', ')}`
		);
	}
	const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));

	const bowls = cart.bowls.map((bowl) => ({ bowl, ...priceBowl(bowl, ingredientMap) }));
	const overweight = bowls.find((b) => b.nutrition.totalWeightG > b.bowl.bowlSize);
	if (overweight) {
		return badRequest(
			`Total weight (${overweight.nutrition.totalWeightG}g) exceeds bowl capacity (${overweight.bowl.bowlSize}g)`
		);
	}
	const subtotal = bowls.reduce((sum, b) => sum + b.unitPrice * b.bowl.quantity, 0);

	const deliveryFee = await getDeliveryFee(cart.address);
	if (deliveryFee === null) return badRequest('address_not_found');

	let coupon: Coupon | null = null;
	let discount = 0;
	let couponRejection: CheckoutQuote['couponRejection'] = null;
	if (cart.couponCode?.trim()) {
		const evaluation = await evaluateCoupon(cart.couponCode, {
			bowlCount: cart.bowls.reduce((sum, bowl) => sum + bowl.quantity, 0),
			subtotal,
			deliveryFee,
			phone
		});
		if (evaluation.ok) ({ coupon, discount } = evaluation);
		else couponRejection = { reason: evaluation.reason, minBowls: evaluation.minBowls };
	}

	const { serviceFee, total } = computeTotals(subtotal, deliveryFee, discount);
	const quote: CheckoutQuote = {
		subtotal,
		deliveryFee,
		discount,
		serviceFee,
		total,
		totalBeforeDiscount: computeTotals(subtotal, deliveryFee, 0).total,
		coupon: coupon && {
			code: coupon.code,
			type: coupon.type as CouponType,
			value: coupon.value?.toNumber() ?? null
		},
		couponRejection
	};
	return { quote, coupon, bowls };
}

const isResponse = (value: object): value is APIGatewayProxyResult => 'statusCode' in value;

/**
 * POST /api/checkout/quote
 * Body: CheckoutQuoteRequest -> CheckoutQuote. A rejected coupon is still 200.
 */
export const quoteCheckout: APIGatewayProxyHandler = async (event) => {
	try {
		if (!event.body) return badRequest('Request body is required');

		const parseResult = quoteSchema.safeParse(JSON.parse(event.body));
		if (!parseResult.success) return badRequest('Validation failed', parseResult.error.flatten());

		const priced = await priceCart(parseResult.data, parseResult.data.phone);
		if (isResponse(priced)) return priced;

		return success(priced.quote);
	} catch (error) {
		console.error('Error quoting checkout:', error);
		return serverError('Failed to quote checkout');
	}
};

/**
 * POST /api/checkout
 * Body: CreateCheckoutRequest -> 201 CreateCheckoutResponse
 */
export const createCheckout: APIGatewayProxyHandler = async (event) => {
	try {
		// Fail open — if the config read throws, log and carry on.
		try {
			const storeConfig = await prisma.storeConfig.findFirst();
			if (storeConfig?.ordersPaused === true) return serviceUnavailable('ordersPaused');
		} catch (configError) {
			console.error('Error reading store config (failing open):', configError);
		}

		if (!event.body) return badRequest('Request body is required');

		const parseResult = createSchema.safeParse(JSON.parse(event.body));
		if (!parseResult.success) return badRequest('Validation failed', parseResult.error.flatten());
		const { customer, address, deliveryInstructions } = parseResult.data;

		const priced = await priceCart(parseResult.data, customer.phone);
		if (isResponse(priced)) return priced;
		const { quote, coupon, bowls } = priced;
		if (quote.couponRejection) return conflict('coupon_rejected', quote.couponRejection);

		let checkout;
		try {
			checkout = await prisma.$transaction(
				async (tx) => {
					// Returning customers keep their stored name.
					let user = await tx.user.findUnique({ where: { phone: customer.phone } });
					if (!user) {
						user = await tx.user.create({ data: { name: customer.name, phone: customer.phone } });
					}

					const addressFields = { userId: user.id, streetAddress: address, ...BOGOTA };
					let savedAddress = await tx.address.findFirst({
						where: { ...addressFields, postalCode: null }
					});
					if (!savedAddress) savedAddress = await tx.address.create({ data: addressFields });

					if (
						coupon &&
						quote.discount > 0 &&
						!(await reserveBudget(tx, coupon.id, quote.discount))
					) {
						throw new BudgetTaken();
					}

					const newCheckout = await tx.checkout.create({
						data: {
							userId: user.id,
							subtotal: quote.subtotal,
							deliveryFee: quote.deliveryFee,
							discount: quote.discount,
							serviceFee: quote.serviceFee,
							total: quote.total,
							paymentStatus: 'not_required',
							couponId: coupon?.id ?? null
						}
					});

					// One order per physical bowl: the kitchen prepares and labels each one.
					for (const { bowl, nutrition, unitPrice } of bowls) {
						for (let n = 0; n < bowl.quantity; n++) {
							await tx.order.create({
								data: {
									userId: user.id,
									checkoutId: newCheckout.id,
									addressId: savedAddress.id,
									deliveryStreetAddress: savedAddress.streetAddress,
									deliveryNeighborhood: savedAddress.neighborhood,
									deliveryCity: savedAddress.city,
									deliveryDepartment: savedAddress.department,
									deliveryPostalCode: savedAddress.postalCode,
									deliveryInstructions: deliveryInstructions ?? null,
									bowlSize: bowl.bowlSize,
									status: 'pending',
									includeCutlery: bowl.includeCutlery,
									totalCalories: nutrition.totalCalories,
									totalProteinG: nutrition.totalProteinG,
									totalCarbsG: nutrition.totalCarbsG,
									totalFatG: nutrition.totalFatG,
									totalFiberG: nutrition.totalFiberG,
									totalWeightG: nutrition.totalWeightG,
									totalPrice: unitPrice,
									items: {
										create: bowl.items.map((item, index) => ({
											ingredientId: item.ingredientId,
											quantityGrams: item.quantityGrams,
											sequenceOrder: index + 1
										}))
									}
								}
							});
						}
					}
					return newCheckout;
				},
				{ timeout: 15000 }
			);
		} catch (error) {
			if (error instanceof BudgetTaken) {
				return conflict('coupon_rejected', { reason: 'budget_exhausted' });
			}
			throw error;
		}

		const response: CreateCheckoutResponse = {
			checkoutId: checkout.id,
			orderNumber: checkout.orderNumber
		};
		return created(response);
	} catch (error) {
		console.error('Error creating checkout:', error);
		return serverError('Failed to create checkout');
	}
};

/**
 * GET /api/checkout/{id}
 */
export const getCheckout: APIGatewayProxyHandler = async (event) => {
	try {
		const id = event.pathParameters?.id ?? '';
		if (!z.string().uuid().safeParse(id).success) return notFound('Checkout not found');

		const checkout = await prisma.checkout.findUnique({ where: { id } });
		if (!checkout) return notFound('Checkout not found');

		const response: CheckoutStatusResponse = {
			checkoutId: checkout.id,
			orderNumber: checkout.orderNumber,
			paymentStatus: checkout.paymentStatus as PaymentStatus,
			total: checkout.total
		};
		return success(response);
	} catch (error) {
		console.error('Error fetching checkout:', error);
		return serverError('Failed to fetch checkout');
	}
};
