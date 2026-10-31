import { describe, it, expect } from 'vitest';
import { nextPickupDate } from '../pickup.js';

// Noon in Bogotá is 17:00 UTC. 2026-11-02 is a Monday.
describe('nextPickupDate', () => {
	it.each([
		['Mon', '2026-11-02T17:00:00Z', '2026-11-03'],
		['Thu', '2026-11-05T17:00:00Z', '2026-11-06'],
		['Fri', '2026-11-06T17:00:00Z', '2026-11-09'],
		['Sat', '2026-11-07T17:00:00Z', '2026-11-09'],
		['Sun', '2026-11-08T17:00:00Z', '2026-11-09']
	])('%s → %s', (_day, now, expected) => {
		expect(nextPickupDate(new Date(now))).toBe(expected);
	});

	it('uses the Bogotá day, not the UTC one', () => {
		// Thu 22:00 in Bogotá is already Fri 03:00 UTC
		expect(nextPickupDate(new Date('2026-11-06T03:00:00Z'))).toBe('2026-11-06');
	});
});
