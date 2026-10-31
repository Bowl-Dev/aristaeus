import { createHash, timingSafeEqual } from 'node:crypto';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const digest = (text: string) => createHash('sha256').update(text).digest();

/** Header `x-admin-token` must equal env ADMIN_TOKEN. Timing-safe; hashing first makes both sides the same length. */
export function isAdmin(event: APIGatewayProxyEvent): boolean {
	const expected = process.env.ADMIN_TOKEN;
	if (!expected) return false;
	const header = Object.entries(event.headers ?? {}).find(
		([name]) => name.toLowerCase() === 'x-admin-token'
	)?.[1];
	return typeof header === 'string' && timingSafeEqual(digest(header), digest(expected));
}
