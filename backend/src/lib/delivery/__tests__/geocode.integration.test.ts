/**
 * Live integration check against Bogota's cadastral service.
 *
 * The service is a free public dependency with no SLA, so this test must never
 * fail CI when the service is unreachable: it probes first and skips if the
 * host does not answer. Set `RUN_GEOCODE_INTEGRATION=0` to skip unconditionally.
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { parseAddress } from '../address.js';
import { geocodeAddress, KITCHEN_ORIGIN } from '../geocode.js';
import { haversineLegs } from '../model.js';

const ENABLED = process.env.RUN_GEOCODE_INTEGRATION !== '0';

let serviceReachable = false;

beforeAll(async () => {
	if (!ENABLED) return;
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 8000);
		const response = await fetch(
			'https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/catastro/placadomiciliaria/MapServer/0?f=pjson',
			{ signal: controller.signal }
		);
		clearTimeout(timer);
		serviceReachable = response.ok;
	} catch {
		serviceReachable = false;
	}
}, 20000);

describe('cadastral service (live)', () => {
	it('locates the kitchen at Calle 125 # 18A-05 within ~20 m', async () => {
		if (!serviceReachable) {
			console.warn('Cadastral service unreachable - skipping live geocode check.');
			return;
		}

		const { result, searchTruncated } = await geocodeAddress(parseAddress('Calle 125 # 18A-05')!, {
			useCache: false,
			timeoutMs: 15000
		});

		expect(searchTruncated).toBe(false);
		expect(result).not.toBeNull();
		expect(result!.matchTier).toBe('exact');
		expect(result!.lng).toBeCloseTo(-74.0472, 3);
		expect(result!.lat).toBeCloseTo(4.7041, 3);

		// The kitchen origin constant must agree with what the service returns.
		const legs = haversineLegs(KITCHEN_ORIGIN, { lat: result!.lat, lng: result!.lng });
		expect(legs.northKm + legs.eastKm).toBeLessThan(0.02);
	}, 30000);
});
