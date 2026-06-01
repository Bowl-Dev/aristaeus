import type { BowlSize } from '$lib/types';

export interface BowlSnapshot {
	bowlSize: BowlSize;
	items: Map<number, number>;
	quantity: number;
}

export function addBowl(
	bowls: BowlSnapshot[],
	bowlSize: BowlSize,
	items: Map<number, number> | ReadonlyMap<number, number>
): BowlSnapshot[] {
	return [...bowls, { bowlSize, items: new Map(items), quantity: 1 }];
}

export function removeAt(bowls: BowlSnapshot[], index: number): BowlSnapshot[] {
	return bowls.filter((_, i) => i !== index);
}

export function incrementAt(bowls: BowlSnapshot[], index: number): BowlSnapshot[] {
	return bowls.map((b, i) => (i === index ? { ...b, quantity: b.quantity + 1 } : b));
}

// Decrements the bowl at `index`, clamping at a minimum quantity of 1. Removal
// is handled exclusively by the trash button (removeAt) so the `-` button can
// never delete a bowl.
export function decrementAt(bowls: BowlSnapshot[], index: number): BowlSnapshot[] {
	const target = bowls[index];
	if (!target) return bowls;
	if (target.quantity <= 1) return bowls;
	return bowls.map((b, i) => (i === index ? { ...b, quantity: b.quantity - 1 } : b));
}
