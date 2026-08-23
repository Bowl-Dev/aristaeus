import type { BowlSize } from '$lib/types';

export interface BowlSnapshot {
	bowlSize: BowlSize;
	items: Map<number, number>;
	quantity: number;
	includeCutlery: boolean;
}

export function addBowl(
	bowls: BowlSnapshot[],
	bowlSize: BowlSize,
	items: Map<number, number> | ReadonlyMap<number, number>,
	includeCutlery = false
): BowlSnapshot[] {
	return [...bowls, { bowlSize, items: new Map(items), quantity: 1, includeCutlery }];
}

export function removeAt(bowls: BowlSnapshot[], index: number): BowlSnapshot[] {
	return bowls.filter((_, i) => i !== index);
}

export function incrementAt(bowls: BowlSnapshot[], index: number): BowlSnapshot[] {
	return bowls.map((b, i) => (i === index ? { ...b, quantity: b.quantity + 1 } : b));
}

// Decrements the bowl at `index`. Decrementing the last one removes the bowl:
// since the card's trash icon became an Edit action (ENG-75), the stepper is
// the only deletion path, so it must be able to reach zero. The caller confirms
// before calling this at quantity 1.
export function decrementAt(bowls: BowlSnapshot[], index: number): BowlSnapshot[] {
	const target = bowls[index];
	if (!target) return bowls;
	if (target.quantity <= 1) return removeAt(bowls, index);
	return bowls.map((b, i) => (i === index ? { ...b, quantity: b.quantity - 1 } : b));
}

// Replaces the bowl at `index` with an edited version, keeping its quantity so
// a ×3 bowl stays ×3 after editing. Used by the cart's Edit flow; a no-op if
// the index is out of range.
export function replaceAt(
	bowls: BowlSnapshot[],
	index: number,
	bowlSize: BowlSize,
	items: Map<number, number> | ReadonlyMap<number, number>,
	includeCutlery = false
): BowlSnapshot[] {
	if (!bowls[index]) return bowls;
	return bowls.map((b, i) =>
		i === index ? { bowlSize, items: new Map(items), quantity: b.quantity, includeCutlery } : b
	);
}
