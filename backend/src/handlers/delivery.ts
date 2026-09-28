/**
 * Delivery Cost Estimation API Handlers
 *
 * POST   /api/delivery/estimate          - estimate courier cost for an address
 * GET    /api/delivery/observations      - list recorded courier charges
 * POST   /api/delivery/observations      - record an actual courier charge
 * DELETE /api/delivery/observations/{id} - remove a recorded charge
 *
 * Admin/ops only. Checkout prices delivery through the same path, see lib/delivery/estimate.ts.
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { success, created, badRequest, notFound, serverError } from '../lib/response.js';
import { parseAddress, formatAddress } from '../lib/delivery/address.js';
import { geocodeAddress, KITCHEN_ORIGIN, type MatchTier } from '../lib/delivery/geocode.js';
import { fitDeliveryModel, haversineLegs, looCvMae } from '../lib/delivery/model.js';
import { estimateDelivery, loadObservations } from '../lib/delivery/estimate.js';

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

		const result = await estimateDelivery(parseResult.data.address);
		if (!result) {
			return badRequest(
				'Could not parse the address. Expected a Bogota address such as "Calle 125 # 18A-05".'
			);
		}
		const { address, geocoded, searchTruncated, estimate, accuracy, observationCount } = result;

		if (!geocoded) {
			// A truncated search proves nothing about the address — say so, rather
			// than implying it is absent from the cadastre. Either way there is no
			// estimate: a guessed price is worse than none.
			return success({
				estimate: null,
				matchTier: 'failed',
				confidence: 'low',
				searchTruncated,
				address: formatAddress(address),
				message: searchTruncated
					? 'The address lookup ran out of time before finishing. Please retry.'
					: 'Address could not be located in the cadastre. Enter the courier price by hand.'
			});
		}

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
			observationCount,
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
