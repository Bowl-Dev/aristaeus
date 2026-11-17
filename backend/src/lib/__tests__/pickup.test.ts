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

	// ENG-117: a weekday order before 09:30 Bogotá (14:30 UTC) is picked up the same day.
	it.each([
		['Tue 08:00', '2026-11-03T13:00:00Z', '2026-11-03'],
		['Tue 09:29', '2026-11-03T14:29:00Z', '2026-11-03'],
		['Tue 09:30', '2026-11-03T14:30:00Z', '2026-11-04'],
		['Tue 10:00', '2026-11-03T15:00:00Z', '2026-11-04'],
		['Fri 08:00', '2026-11-06T13:00:00Z', '2026-11-06'],
		['Sat 08:00', '2026-11-07T13:00:00Z', '2026-11-09']
	])('%s → %s', (_when, now, expected) => {
		expect(nextPickupDate(new Date(now))).toBe(expected);
	});
});
