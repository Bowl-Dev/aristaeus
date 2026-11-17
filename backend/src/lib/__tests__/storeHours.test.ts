import { describe, it, expect } from 'vitest';
import { isOpenAt, DEFAULT_WEEKLY_HOURS as hours } from '@aristaeus/shared';

// Bogotá is UTC-5. 2026-11-03 is a Tuesday, 2026-11-07 a Saturday.
describe('isOpenAt', () => {
	it.each([
		['Tue 09:29', '2026-11-03T14:29:00Z', false],
		['Tue 09:30', '2026-11-03T14:30:00Z', true],
		['Tue 14:59', '2026-11-03T19:59:00Z', true],
		['Tue 15:00', '2026-11-03T20:00:00Z', false],
		['Tue 17:00', '2026-11-03T22:00:00Z', true],
		['Tue 19:30', '2026-11-04T00:30:00Z', false],
		['Sat 10:59', '2026-11-07T15:59:00Z', false],
		['Sat 11:00', '2026-11-07T16:00:00Z', true],
		['Sat 16:00', '2026-11-07T21:00:00Z', false]
	])('%s → %s', (_when, now, expected) => {
		expect(isOpenAt(new Date(now), hours)).toBe(expected);
	});

	it('treats a missing or empty day as closed', () => {
		expect(isOpenAt(new Date('2026-11-03T15:00:00Z'), { '2': [] })).toBe(false);
		expect(isOpenAt(new Date('2026-11-03T15:00:00Z'), {})).toBe(false);
	});
});
