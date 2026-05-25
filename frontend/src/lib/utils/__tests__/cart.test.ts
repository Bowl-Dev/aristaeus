import { describe, it, expect } from 'vitest';
import { addBowl, removeAt, incrementAt, decrementAt, type BowlSnapshot } from '../cart';

const bowl = (
	quantity: number,
	items: Map<number, number> = new Map([[1, 100]])
): BowlSnapshot => ({
	bowlSize: 450,
	items,
	quantity
});

describe('addBowl', () => {
	it('appends a new bowl with quantity 1', () => {
		const before = [bowl(1)];
		const after = addBowl(before, 250, new Map([[2, 50]]));
		expect(after).toHaveLength(2);
		expect(after[1]).toEqual({ bowlSize: 250, items: new Map([[2, 50]]), quantity: 1 });
	});

	it('clones the items map (mutating the source map does not affect the snapshot)', () => {
		const items = new Map([[1, 100]]);
		const after = addBowl([], 450, items);
		items.set(99, 999);
		expect(after[0].items.has(99)).toBe(false);
	});

	it('does not mutate the input array', () => {
		const before = [bowl(1)];
		addBowl(before, 250, new Map());
		expect(before).toHaveLength(1);
	});
});

describe('removeAt', () => {
	it('removes the bowl at the given index', () => {
		const before = [bowl(1), bowl(2), bowl(3)];
		const after = removeAt(before, 1);
		expect(after.map((b) => b.quantity)).toEqual([1, 3]);
	});

	it('returns an empty array when removing the only bowl', () => {
		expect(removeAt([bowl(1)], 0)).toEqual([]);
	});
});

describe('incrementAt', () => {
	it('increases only the targeted bowl', () => {
		const before = [bowl(1), bowl(1)];
		const after = incrementAt(before, 0);
		expect(after.map((b) => b.quantity)).toEqual([2, 1]);
	});
});

describe('decrementAt', () => {
	it('decreases the targeted bowl when quantity > 1', () => {
		const before = [bowl(3)];
		const after = decrementAt(before, 0);
		expect(after[0].quantity).toBe(2);
	});

	it('removes the bowl when its quantity would drop to 0', () => {
		const before = [bowl(1), bowl(2)];
		const after = decrementAt(before, 0);
		expect(after).toHaveLength(1);
		expect(after[0].quantity).toBe(2);
	});

	it('is a no-op for an out-of-range index', () => {
		const before = [bowl(1)];
		const after = decrementAt(before, 5);
		expect(after).toBe(before);
	});
});
