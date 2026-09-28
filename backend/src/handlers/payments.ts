/**
 * Payments API Handler
 * POST /api/payments/webhook - Wompi event notifications (the source of truth for payment state)
 *
 * No API auth: the event checksum is the authentication. Every verified event
 * gets a 200 so Wompi stops retrying; only a bad checksum gets a 401.
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { success, unauthorized, serverError, serviceUnavailable } from '../lib/response.js';
import { verifyEventChecksum } from '../lib/wompi.js';
import { failCheckout } from '../lib/coupons.js';

interface WompiTransaction {
	id: string;
	reference: string;
	amount_in_cents: number;
	status: string;
	payment_method_type?: string;
}

const FAILED_STATUSES = ['DECLINED', 'VOIDED', 'ERROR'];

export const wompiWebhook: APIGatewayProxyHandler = async (event) => {
	try {
		const secret = process.env.WOMPI_EVENTS_SECRET;
		if (!secret) return serviceUnavailable('payments_unavailable');

		let body: unknown;
		try {
			body = JSON.parse(event.body ?? '');
		} catch {
			return unauthorized('invalid_checksum');
		}
		if (!verifyEventChecksum(body, secret)) return unauthorized('invalid_checksum');

		const received = success({ received: true });
		if (body.event !== 'transaction.updated') return received;

		const tx = body.data.transaction as WompiTransaction | undefined;
		if (!tx || !z.string().uuid().safeParse(tx.reference).success) {
			console.warn('Wompi event for a reference we did not issue:', tx?.reference);
			return received;
		}

		const checkout = await prisma.checkout.findUnique({ where: { id: tx.reference } });
		if (!checkout) {
			console.warn('Wompi event for unknown checkout:', tx.reference);
			return received;
		}
		if (tx.amount_in_cents !== checkout.total * 100) {
			console.error(
				`Wompi amount mismatch for checkout ${checkout.id}: got ${tx.amount_in_cents}, expected ${checkout.total * 100}`
			);
			return received;
		}

		if (tx.status === 'APPROVED') {
			if (checkout.paymentStatus === 'paid') return received; // redelivery

			await prisma.$transaction(async (db) => {
				// Conditional on the status we read, so a concurrent delivery applies at most once.
				const { count } = await db.checkout.updateMany({
					where: { id: checkout.id, paymentStatus: checkout.paymentStatus },
					data: {
						paymentStatus: 'paid',
						wompiTxId: tx.id,
						paymentMethod: tx.payment_method_type ?? null,
						paidAt: new Date()
					}
				});
				if (count === 0) return;

				// Paid: the orders enter the kitchen queue.
				await db.order.updateMany({
					where: { checkoutId: checkout.id },
					data: { status: 'pending' }
				});

				// Its budget was credited back when it failed (declined or abandoned); the
				// money was taken after all, so take the discount again.
				// ponytail: unconditional, may overshoot the budget slightly; guard with a
				// budgetRemaining >= discount check if late approvals become common.
				if (
					checkout.paymentStatus === 'payment_failed' &&
					checkout.couponId !== null &&
					checkout.discount > 0
				) {
					await db.coupon.update({
						where: { id: checkout.couponId },
						data: { budgetRemaining: { decrement: checkout.discount } }
					});
				}
			});
		} else if (FAILED_STATUSES.includes(tx.status)) {
			await prisma.$transaction((db) => failCheckout(db, checkout.id));
		}

		return received;
	} catch (error) {
		console.error('Error handling Wompi webhook:', error);
		return serverError('Failed to handle webhook');
	}
};
