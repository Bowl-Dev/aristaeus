import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	hasLegacyCorrections,
	legacyAddressText,
	migrateLegacyCorrections,
	readLegacyCorrections
} from '../deliveryCalibration';
import { createDeliveryObservation } from '$lib/api/client';

vi.mock('$lib/api/client', () => ({
	createDeliveryObservation: vi.fn()
}));

const STORAGE_KEY = 'aristaeus.delivery.calibration.v1';

function seedStorage(corrections: unknown[]): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, corrections }));
}

describe('legacy calibration migration', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.mocked(createDeliveryObservation).mockReset();
		vi.mocked(createDeliveryObservation).mockResolvedValue({
			id: 1,
			rawAddress: 'Calle 146 # 21-86',
			lat: null,
			lng: null,
			matchTier: 'exact',
			northKm: null,
			eastKm: null,
			actualCost: 3700,
			source: 'correction',
			recordedAt: new Date().toISOString()
		});
	});

	it('reports nothing to migrate on a clean browser', () => {
		expect(readLegacyCorrections()).toEqual([]);
		expect(hasLegacyCorrections()).toBe(false);
	});

	it('reads rows left by the retired localStorage store', () => {
		seedStorage([{ calle: '146', carrera: '21', numero: 86, actualCost: 3700 }]);
		expect(hasLegacyCorrections()).toBe(true);
		expect(readLegacyCorrections()).toHaveLength(1);
	});

	it('drops malformed rows instead of failing the whole migration', () => {
		seedStorage([
			{ calle: '146', carrera: '21', numero: 86, actualCost: 3700 },
			{ calle: '', carrera: '21', numero: 86, actualCost: 3700 },
			{ calle: '146', carrera: '21', numero: 86, actualCost: -100 }
		]);
		expect(readLegacyCorrections()).toHaveLength(1);
	});

	it('recovers from corrupt storage', () => {
		localStorage.setItem(STORAGE_KEY, 'not json');
		expect(readLegacyCorrections()).toEqual([]);
	});

	it('writes the address the way the server parser reads it', () => {
		expect(legacyAddressText({ calle: '146', carrera: '21', numero: 86, actualCost: 3700 })).toBe(
			'Calle 146 # 21-86'
		);
	});

	it('uploads every row and then clears the legacy key', async () => {
		seedStorage([
			{ calle: '146', carrera: '21', numero: 86, actualCost: 3700 },
			{ calle: '119', carrera: '14', numero: 16, actualCost: 2800 }
		]);

		const result = await migrateLegacyCorrections();

		expect(result).toEqual({ found: 2, uploaded: 2, failed: 0, cleared: true });
		expect(createDeliveryObservation).toHaveBeenCalledWith({
			address: 'Calle 146 # 21-86',
			actualCost: 3700,
			source: 'correction'
		});
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	it('keeps the data on disk when an upload fails', async () => {
		seedStorage([{ calle: '146', carrera: '21', numero: 86, actualCost: 3700 }]);
		vi.mocked(createDeliveryObservation).mockRejectedValueOnce(new Error('network down'));

		const result = await migrateLegacyCorrections();

		expect(result.failed).toBe(1);
		expect(result.cleared).toBe(false);
		expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
	});

	it('does not call the API when there is nothing to migrate', async () => {
		const result = await migrateLegacyCorrections();
		expect(result.found).toBe(0);
		expect(createDeliveryObservation).not.toHaveBeenCalled();
	});
});
