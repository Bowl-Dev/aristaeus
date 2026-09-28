import { describe, it, expect } from 'vitest';
import { signIntegrity, verifyEventChecksum } from '../wompi.js';

describe('wompi', () => {
	it('signs integrity like the Web Checkout docs example', () => {
		expect(
			signIntegrity(
				'sk8-438k4-xmxm392-sn2m',
				2490000,
				'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6'
			)
		).toBe('37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
	});

	// Inputs are the events docs example. The docs print 3476DDA5...C8BD0 as the result,
	// but that hash does not reproduce from the documented string; this is
	// sha256('1234-1610641025-49201APPROVED44900001530291411prod_events_...') via node:crypto.
	const secret = 'prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z';
	const event = () => ({
		event: 'transaction.updated',
		data: {
			transaction: { id: '1234-1610641025-49201', status: 'APPROVED', amount_in_cents: 4490000 }
		},
		timestamp: 1530291411,
		signature: {
			properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
			checksum: '5A18EC5E8FDB7DF463E9F94774CBA8F583BA21BD04A09CEFF2EA68A4BC0AEFBE'
		}
	});

	it('accepts a correctly signed event, case-insensitively', () => {
		expect(verifyEventChecksum(event(), secret)).toBe(true);
	});

	it('rejects a tampered event, a wrong secret and malformed input', () => {
		const tampered = event();
		tampered.data.transaction.status = 'DECLINED';
		expect(verifyEventChecksum(tampered, secret)).toBe(false);
		expect(verifyEventChecksum(event(), 'other')).toBe(false);
		expect(verifyEventChecksum({ data: {} }, secret)).toBe(false);
		expect(verifyEventChecksum(null, secret)).toBe(false);
	});
});
