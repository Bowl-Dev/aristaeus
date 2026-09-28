/**
 * Wompi signatures.
 * https://docs.wompi.co/en/docs/colombia/widget-checkout-web/ (integrity)
 * https://docs.wompi.co/en/docs/colombia/eventos/ (event checksum)
 */

import { createHash, timingSafeEqual } from 'node:crypto';

export interface WompiEvent {
	event: string;
	data: Record<string, unknown>;
	timestamp: number;
	signature: { properties: string[]; checksum: string };
	environment?: string;
	sent_at?: string;
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** `signature:integrity` for Web Checkout: sha256(reference + amountInCents + 'COP' + secret). */
export function signIntegrity(reference: string, amountInCents: number, secret: string): string {
	return sha256(`${reference}${amountInCents}COP${secret}`);
}

/**
 * The checksum Wompi should have sent: the values at each `signature.properties`
 * path (relative to `data`, in the order given), then `timestamp`, then the secret.
 * Wompi may change the property list, so it is always read from the event.
 */
export function eventChecksum(
	event: Pick<WompiEvent, 'data' | 'timestamp' | 'signature'>,
	secret: string
) {
	const values = event.signature.properties.map((path) =>
		path
			.split('.')
			.reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], event.data)
	);
	return sha256(values.join('') + event.timestamp + secret);
}

/** Timing-safe, case-insensitive. False for anything malformed. */
export function verifyEventChecksum(event: unknown, secret: string): event is WompiEvent {
	const candidate = event as WompiEvent;
	const properties = candidate?.signature?.properties;
	const checksum = candidate?.signature?.checksum;
	if (!Array.isArray(properties) || typeof checksum !== 'string' || !candidate.data) return false;

	const expected = Buffer.from(eventChecksum(candidate, secret));
	const received = Buffer.from(checksum.toLowerCase());
	return expected.length === received.length && timingSafeEqual(expected, received);
}
