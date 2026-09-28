import type { CreateCheckoutResponse } from '$lib/types';

/**
 * Wompi Web Checkout URL for a created checkout. URLSearchParams encodes
 * `signature:integrity` as `signature%3Aintegrity` and the redirect URL, as Wompi expects.
 */
export function wompiCheckoutUrl(checkout: CreateCheckoutResponse, redirectUrl: string): string {
	const params = new URLSearchParams({
		'public-key': checkout.publicKey,
		currency: checkout.currency,
		'amount-in-cents': String(checkout.amountInCents),
		reference: checkout.reference,
		'signature:integrity': checkout.signature,
		'redirect-url': redirectUrl
	});
	return `https://checkout.wompi.co/p/?${params}`;
}
