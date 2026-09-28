/**
 * The delivery estimate path, shared by the ops estimate endpoint and checkout.
 */

import { roundToNearestCoin } from '@aristaeus/shared';
import prisma from '../db.js';
import { parseAddress } from './address.js';
import { geocodeAddress, KITCHEN_ORIGIN } from './geocode.js';
import {
	estimateFromLegs,
	fitDeliveryModel,
	haversineLegs,
	looCvMae,
	type LegObservation,
	type Legs
} from './model.js';

/**
 * Load the training set from Postgres.
 *
 * Legs are recomputed from `lat`/`lng` whenever those are present, so a change
 * to the kitchen origin or the grid bearing does not leave stale distances in
 * the training data. The stored `north_km`/`east_km` are only a fallback.
 */
export async function loadObservations(): Promise<LegObservation[]> {
	const rows = await prisma.deliveryObservation.findMany();

	const observations: LegObservation[] = [];
	for (const row of rows) {
		let legs: Legs | null = null;
		if (row.lat !== null && row.lng !== null) {
			legs = haversineLegs(KITCHEN_ORIGIN, {
				lat: row.lat.toNumber(),
				lng: row.lng.toNumber()
			});
		} else if (row.northKm !== null && row.eastKm !== null) {
			legs = { northKm: row.northKm.toNumber(), eastKm: row.eastKm.toNumber() };
		}
		if (!legs) continue;

		observations.push({
			...legs,
			actualCost: row.actualCost,
			source: row.source === 'correction' ? 'correction' : 'seed'
		});
	}
	return observations;
}

/**
 * Parse, geocode and price one free-form address. `null` when it does not
 * parse; `estimate` is `null` when it could not be geocoded (see `searchTruncated`).
 */
export async function estimateDelivery(rawAddress: string) {
	const address = parseAddress(rawAddress);
	if (!address) return null;

	const observations = await loadObservations();
	const model = fitDeliveryModel(observations);
	const accuracy = looCvMae(observations);

	const { result: geocoded, searchTruncated } = await geocodeAddress(address);
	const estimate = geocoded
		? estimateFromLegs(
				model,
				haversineLegs(KITCHEN_ORIGIN, { lat: geocoded.lat, lng: geocoded.lng })
			)
		: null;

	return {
		address,
		geocoded,
		searchTruncated,
		estimate,
		/** Leave-one-out cross-validated MAE in COP, null with too few observations. */
		accuracy,
		observationCount: observations.length
	};
}

/**
 * What checkout charges for delivery: the estimate plus its cross-validated
 * MAE as a margin. `null` when the address cannot be priced — checkout must block.
 */
export async function getDeliveryFee(address: string): Promise<number | null> {
	const result = await estimateDelivery(address);
	if (!result?.estimate) return null;
	return roundToNearestCoin(result.estimate.cost + (result.accuracy ?? 0));
}
