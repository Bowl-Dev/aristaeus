import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db.js', () => ({
	default: { deliveryObservation: { findMany: vi.fn().mockResolvedValue([]) } }
}));
vi.mock('../geocode.js', () => ({
	KITCHEN_ORIGIN: { lat: 4.7, lng: -74.04 },
	geocodeAddress: vi.fn().mockResolvedValue({
		result: { lat: 4.65, lng: -74.06 },
		searchTruncated: false
	})
}));
vi.mock('../model.js', () => ({
	fitDeliveryModel: vi.fn(),
	haversineLegs: vi.fn(),
	estimateFromLegs: vi.fn().mockReturnValue({ cost: 7340 }),
	looCvMae: vi.fn().mockReturnValue(900)
}));

import { getDeliveryFee } from '../estimate.js';

describe('getDeliveryFee', () => {
	it('charges the point estimate rounded to a coin, without the MAE margin', async () => {
		expect(await getDeliveryFee('Calle 100 # 15-20')).toBe(7300);
	});
});
