/**
 * Delivery Cost Estimation API Handlers
 *
 * POST   /api/delivery/estimate          - estimate courier cost for an address
 * GET    /api/delivery/observations      - list recorded courier charges
 * POST   /api/delivery/observations      - record an actual courier charge
 * DELETE /api/delivery/observations/{id} - remove a recorded charge
 *
 * Admin/ops only. Customer checkout is unchanged.
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { success, created, badRequest, notFound, serverError } from '../lib/response.js';
import { parseAddress, formatAddress, type ParsedAddress } from '../lib/delivery/address.js';
import { geocodeAddress, KITCHEN_ORIGIN, type MatchTier } from '../lib/delivery/geocode.js';
import {
	estimateFromLegs,
	fitDeliveryModel,
	gridLegs,
	GRID_MODEL,
	haversineLegs,
	looCvMae,
	type LegObservation,
	type Legs
} from '../lib/delivery/model.js';

const estimateSchema = z.object({
	address: z.string().min(1, 'Address is required').max(255)
});

const observationSchema = z.object({
	address: z.string().min(1, 'Address is required').max(255),
	actualCost: z.number().int().positive('Actual cost must be a positive number of COP'),
	source: z.enum(['seed', 'correction']).default('correction')
});

/** Confidence label shown to ops, derived from the geocode match tier. */
function confidenceFor(tier: MatchTier): 'high' | 'good' | 'medium' | 'low' {
	switch (tier) {
		case 'exact':
			return 'high';
		case 'nearest_number':
			return 'good';
		case 'nearest_cross':
			return 'medium';
		default:
			return 'low';
	}
}

/**
 * Load the training set from Postgres.
 *
 * Legs are recomputed from `lat`/`lng` whenever those are present, so a change
 * to the kitchen origin or the grid bearing does not leave stale distances in
 * the training data. The stored `north_km`/`east_km` are only a fallback.
 */
async function loadObservations(): Promise<LegObservation[]> {
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
 * Fall back to the v1 synthetic-grid geometry when the cadastral service
 * cannot resolve the address.
 *
 * Grid legs are in a different coordinate basis from geocoded legs, so they
 * must be priced with {@link GRID_MODEL} — the model fitted on grid legs —
 * never with the model fitted on real coordinates. The result is always
 * labelled `grid_fallback`.
 */
function gridFallbackEstimate(address: ParsedAddress) {
	// v1 spoke in calle/carrera; map the parsed address onto that vocabulary.
	const legs = gridLegs({
		calle: address.street.toLowerCase(),
		carrera: address.cross.toLowerCase(),
		numero: address.number
	});
	if (!legs) return null;

	const estimate = estimateFromLegs(GRID_MODEL, legs);
	return {
		...estimate,
		matchTier: 'grid_fallback' as MatchTier,
		confidence: 'low' as const,
		resolvedPlate: null,
		coordinates: null
	};
}

/**
 * POST /api/delivery/estimate
 * Body: { address: string }
 */
export const estimateDeliveryCost: APIGatewayProxyHandler = async (event) => {
	try {
		if (!event.body) return badRequest('Request body is required');

		const body = JSON.parse(event.body);
		const parseResult = estimateSchema.safeParse(body);
		if (!parseResult.success) {
			return badRequest('Validation failed', parseResult.error.flatten());
		}

		const address = parseAddress(parseResult.data.address);
		if (!address) {
			return badRequest(
				'Could not parse the address. Expected a Bogota address such as "Calle 125 # 18A-05".'
			);
		}

		const observations = await loadObservations();
		const model = fitDeliveryModel(observations);
		const accuracy = looCvMae(observations);

		const { result: geocoded, searchTruncated } = await geocodeAddress(address);

		if (!geocoded) {
			// A truncated search proves nothing about the address — say so, rather
			// than implying it is absent from the cadastre.
			const message = searchTruncated
				? 'The address lookup ran out of time before finishing. This estimate uses the ' +
					'approximate street grid; retry for a precise result.'
				: 'Address could not be located in the cadastre. This estimate uses the approximate street grid.';

			const fallback = gridFallbackEstimate(address);
			if (!fallback) {
				return success({
					estimate: null,
					matchTier: 'failed',
					confidence: 'low',
					searchTruncated,
					address: formatAddress(address),
					message: searchTruncated
						? 'The address lookup ran out of time and the grid fallback did not apply. Please retry.'
						: 'Address could not be located and the grid fallback did not apply.'
				});
			}
			return success({
				estimate: {
					cost: fallback.cost,
					northKm: fallback.northKm,
					eastKm: fallback.eastKm,
					totalKm: fallback.totalKm,
					minFareApplied: fallback.minFareApplied
				},
				matchTier: fallback.matchTier,
				confidence: fallback.confidence,
				searchTruncated,
				resolvedPlate: null,
				coordinates: null,
				// The grid model is fitted on grid legs, so its accuracy figure is
				// the grid model's, not the geocoded model's.
				accuracyCop: null,
				observationCount: observations.length,
				address: formatAddress(address),
				message
			});
		}

		const legs = haversineLegs(KITCHEN_ORIGIN, { lat: geocoded.lat, lng: geocoded.lng });
		const estimate = estimateFromLegs(model, legs);

		return success({
			estimate,
			matchTier: geocoded.matchTier,
			confidence: confidenceFor(geocoded.matchTier),
			searchTruncated,
			resolvedPlate: geocoded.resolvedPlate,
			coordinates: { lat: geocoded.lat, lng: geocoded.lng },
			cached: geocoded.cached,
			/** Leave-one-out cross-validated MAE in COP — the "give or take" figure. */
			accuracyCop: accuracy,
			observationCount: observations.length,
			address: formatAddress(address)
		});
	} catch (error) {
		console.error('Error estimating delivery cost:', error);
		return serverError('Failed to estimate delivery cost');
	}
};

/**
 * GET /api/delivery/observations
 * Lists the recorded courier charges the model is fitted on.
 */
export const listDeliveryObservations: APIGatewayProxyHandler = async () => {
	try {
		const rows = await prisma.deliveryObservation.findMany({
			orderBy: { recordedAt: 'desc' }
		});

		const observations = rows.map((row) => ({
			id: row.id,
			rawAddress: row.rawAddress,
			prefix: row.prefix,
			street: row.street,
			cross: row.cross,
			number: row.number,
			lat: row.lat?.toNumber() ?? null,
			lng: row.lng?.toNumber() ?? null,
			matchTier: row.matchTier,
			northKm: row.northKm?.toNumber() ?? null,
			eastKm: row.eastKm?.toNumber() ?? null,
			actualCost: row.actualCost,
			source: row.source,
			recordedAt: row.recordedAt.toISOString()
		}));

		const fitted = await loadObservations();

		return success({
			observations,
			count: observations.length,
			accuracyCop: looCvMae(fitted),
			model: fitDeliveryModel(fitted)
		});
	} catch (error) {
		console.error('Error listing delivery observations:', error);
		return serverError('Failed to list delivery observations');
	}
};

/**
 * POST /api/delivery/observations
 * Body: { address: string, actualCost: number, source?: 'seed' | 'correction' }
 *
 * Records what a courier actually charged. This is how the model improves.
 */
export const createDeliveryObservation: APIGatewayProxyHandler = async (event) => {
	try {
		if (!event.body) return badRequest('Request body is required');

		const body = JSON.parse(event.body);
		const parseResult = observationSchema.safeParse(body);
		if (!parseResult.success) {
			return badRequest('Validation failed', parseResult.error.flatten());
		}

		const { address: rawAddress, actualCost, source } = parseResult.data;

		const address = parseAddress(rawAddress);
		if (!address) {
			return badRequest(
				'Could not parse the address. Expected a Bogota address such as "Calle 125 # 18A-05".'
			);
		}

		// Geocode once at write time so every observation shares one coordinate
		// basis with the estimates it will later be used to produce.
		const { result: geocoded } = await geocodeAddress(address);
		const legs = geocoded
			? haversineLegs(KITCHEN_ORIGIN, { lat: geocoded.lat, lng: geocoded.lng })
			: null;

		const observation = await prisma.deliveryObservation.create({
			data: {
				rawAddress,
				prefix: address.prefix,
				street: address.street,
				cross: address.cross,
				number: address.number,
				lat: geocoded?.lat ?? null,
				lng: geocoded?.lng ?? null,
				matchTier: geocoded?.matchTier ?? 'failed',
				northKm: legs?.northKm ?? null,
				eastKm: legs?.eastKm ?? null,
				actualCost,
				source
			}
		});

		return created({
			id: observation.id,
			rawAddress: observation.rawAddress,
			lat: observation.lat?.toNumber() ?? null,
			lng: observation.lng?.toNumber() ?? null,
			matchTier: observation.matchTier,
			northKm: observation.northKm?.toNumber() ?? null,
			eastKm: observation.eastKm?.toNumber() ?? null,
			actualCost: observation.actualCost,
			source: observation.source,
			recordedAt: observation.recordedAt.toISOString()
		});
	} catch (error) {
		console.error('Error creating delivery observation:', error);
		return serverError('Failed to create delivery observation');
	}
};

/**
 * DELETE /api/delivery/observations/{id}
 */
export const deleteDeliveryObservation: APIGatewayProxyHandler = async (event) => {
	try {
		const id = parseInt(event.pathParameters?.id ?? '');
		if (isNaN(id)) return badRequest('Valid observation id is required');

		const existing = await prisma.deliveryObservation.findUnique({ where: { id } });
		if (!existing) return notFound('Delivery observation not found');

		await prisma.deliveryObservation.delete({ where: { id } });

		return success({ deleted: true, id });
	} catch (error) {
		console.error('Error deleting delivery observation:', error);
		return serverError('Failed to delete delivery observation');
	}
};
