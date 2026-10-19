import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db.js', () => ({
	default: { deliveryObservation: { findMany: vi.fn() } }
}));
vi.mock('../geocode.js', () => ({
	KITCHEN_ORIGIN: { lat: 4.7, lng: -74.04 },
	geocodeAddress: vi.fn()
}));
vi.mock('../model.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../model.js')>()),
	fitDeliveryModel: vi.fn(),
	haversineLegs: vi.fn(),
	estimateFromLegs: vi.fn().mockReturnValue({ cost: 7340 }),
	looCvMae: vi.fn().mockReturnValue(900)
}));

import prisma from '../../db.js';
import { geocodeAddress } from '../geocode.js';
import { getDeliveryFee } from '../estimate.js';

const decimal = (n: number) => ({ toNumber: () => n });
const observation = (actualCost: number) => ({
	lat: null,
	lng: null,
	northKm: decimal(1),
	eastKm: decimal(1),
	actualCost,
	source: 'correction'
});
const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('getDeliveryFee', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(prisma.deliveryObservation.findMany).mockResolvedValue([]);
		vi.mocked(geocodeAddress).mockResolvedValue({
			result: { lat: 4.65, lng: -74.06 },
			searchTruncated: false
		} as never);
	});

	it('charges the point estimate rounded to a coin, without the MAE margin', async () => {
		expect(await getDeliveryFee('Calle 100 # 15-20')).toBe(7300);
	});

	it('charges the median past cost when the cadastre cannot place the address', async () => {
		vi.mocked(prisma.deliveryObservation.findMany).mockResolvedValue(
			[3000, 9000, 4000, 5000].map(observation) as never
		);
		vi.mocked(geocodeAddress).mockResolvedValue({ result: null, searchTruncated: true });

		expect(await getDeliveryFee('Calle 100 # 15-20')).toBe(4500);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('(truncated)'));
	});

	it('falls back to the seed median for an unparsed address with no observations', async () => {
		// Seed costs sort to ... 4100, 4600 ... in the middle: 4350, rounded to 4400.
		expect(await getDeliveryFee('Carrera 10 # 15-20 Sur')).toBe(4400);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('(unparsed) for address "Carrera 10 # 15-20 Sur"')
		);
	});
});
