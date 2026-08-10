import { describe, it, expect, beforeEach } from 'vitest';
import {
	BASELINE_MODEL,
	KITCHEN_ORIGIN,
	SEED_OBSERVATIONS,
	addressDistance,
	estimateDelivery,
	fitDeliveryModel,
	formatAddress,
	isValidAddress,
	meanAbsoluteError,
	parseStreetToken,
	type DeliveryObservation
} from '../deliveryModel';
import {
	addCorrection,
	calibrationSet,
	clearCorrections,
	currentModel,
	exportCorrections,
	importCorrections,
	loadCorrections,
	removeCorrection
} from '../deliveryCalibration';

describe('parseStreetToken', () => {
	it('parses a plain street number', () => {
		expect(parseStreetToken('146')).toBe(146);
	});

	it('places a letter suffix inside the block that follows the number', () => {
		expect(parseStreetToken('145a')).toBe(145.25);
		expect(parseStreetToken('19b')).toBe(19.5);
	});

	it('places bis mid-block', () => {
		expect(parseStreetToken('25bis')).toBe(25.5);
		expect(parseStreetToken('14 bis')).toBe(14.5);
	});

	it('is case insensitive and trims whitespace', () => {
		expect(parseStreetToken(' 18A ')).toBe(18.25);
	});

	it('rejects anything that is not a street token', () => {
		expect(parseStreetToken('')).toBeNull();
		expect(parseStreetToken('abc')).toBeNull();
		expect(parseStreetToken('12-34')).toBeNull();
		expect(parseStreetToken('9999')).toBeNull();
	});
});

describe('isValidAddress', () => {
	it('accepts a complete address', () => {
		expect(isValidAddress({ calle: '146', carrera: '21', numero: 86 })).toBe(true);
	});

	it('rejects missing or negative components', () => {
		expect(isValidAddress({ calle: '146', carrera: '', numero: 86 })).toBe(false);
		expect(isValidAddress({ calle: '146', carrera: '21', numero: NaN })).toBe(false);
		expect(isValidAddress({ calle: '146', carrera: '21', numero: -5 })).toBe(false);
	});
});

describe('addressDistance', () => {
	it('is zero at the kitchen itself', () => {
		const distance = addressDistance(KITCHEN_ORIGIN);
		expect(distance).toEqual({ northKm: 0, eastKm: 0 });
	});

	it('converts calle difference into a north-south leg at 100 m per block', () => {
		// Calle 146 is 21 blocks north of Calle 125.
		const distance = addressDistance({ calle: '146', carrera: '18a', numero: 5 });
		expect(distance?.northKm).toBeCloseTo(2.1, 5);
		expect(distance?.eastKm).toBeCloseTo(0, 5);
	});

	it('folds the trailing number into the east-west leg', () => {
		// Same carrera as the kitchen, but 105 m further along the block.
		const distance = addressDistance({ calle: '125', carrera: '18a', numero: 110 });
		expect(distance?.eastKm).toBeCloseTo(0.105, 5);
	});

	it('treats direction as symmetric', () => {
		const north = addressDistance({ calle: '145', carrera: '18a', numero: 5 });
		const south = addressDistance({ calle: '105', carrera: '18a', numero: 5 });
		expect(north?.northKm).toBeCloseTo(south?.northKm ?? -1, 5);
	});

	it('returns null for an unparseable address', () => {
		expect(addressDistance({ calle: 'nope', carrera: '21', numero: 86 })).toBeNull();
	});
});

describe('estimateDelivery', () => {
	it('never quotes below the minimum fare', () => {
		// Next door to the kitchen.
		const estimate = estimateDelivery({ calle: '125', carrera: '18a', numero: 20 });
		expect(estimate?.cost).toBe(BASELINE_MODEL.minFare);
		expect(estimate?.minFareApplied).toBe(true);
	});

	it('grows with distance', () => {
		const near = estimateDelivery({ calle: '122', carrera: '19', numero: 45 });
		const mid = estimateDelivery({ calle: '93', carrera: '19', numero: 55 });
		const far = estimateDelivery({ calle: '26', carrera: '42', numero: 90 });
		expect(near!.cost).toBeLessThan(mid!.cost);
		expect(mid!.cost).toBeLessThan(far!.cost);
	});

	it('rounds to the nearest 100 COP', () => {
		const estimate = estimateDelivery({ calle: '26', carrera: '42', numero: 90 });
		expect(estimate!.cost % 100).toBe(0);
	});

	it('stays close to the real prices in the Ops history', () => {
		// The seed data contains one address delivered twice at 3,300 and 4,100,
		// so ~800 COP of spread is courier noise. Anything under ~1,000 average
		// error means the grid model is carrying real signal.
		expect(meanAbsoluteError(BASELINE_MODEL, SEED_OBSERVATIONS)!).toBeLessThan(1000);
	});

	it('predicts a long southbound trip within 15% of what it really cost', () => {
		const estimate = estimateDelivery({ calle: '26', carrera: '42', numero: 90 });
		expect(estimate!.cost).toBeGreaterThan(14100 * 0.85);
		expect(estimate!.cost).toBeLessThan(14100 * 1.15);
	});

	it('returns null for an unparseable address', () => {
		expect(estimateDelivery({ calle: '', carrera: '21', numero: 86 })).toBeNull();
	});
});

describe('fitDeliveryModel', () => {
	it('charges more per east-west km than per north-south km', () => {
		// Fewer through-streets on that axis; this is the shape the Ops data shows.
		expect(BASELINE_MODEL.ratePerKmEW).toBeGreaterThan(BASELINE_MODEL.ratePerKmNS);
	});

	it('takes the minimum fare from the cheapest observed delivery', () => {
		expect(BASELINE_MODEL.minFare).toBe(2800);
	});

	it('falls back to sane coefficients when there is too little data', () => {
		const model = fitDeliveryModel([
			{ calle: '146', carrera: '21', numero: 86, actualCost: 3700, source: 'correction' }
		]);
		expect(model.ratePerKmNS).toBeGreaterThan(0);
		expect(model.minFare).toBe(3700);
	});

	it('never produces a negative rate', () => {
		// Prices that fall as distance grows would otherwise invert the slope.
		const perverse: DeliveryObservation[] = [
			{ calle: '126', carrera: '18a', numero: 5, actualCost: 20000, source: 'correction' },
			{ calle: '140', carrera: '18a', numero: 5, actualCost: 15000, source: 'correction' },
			{ calle: '160', carrera: '18a', numero: 5, actualCost: 9000, source: 'correction' },
			{ calle: '170', carrera: '18a', numero: 5, actualCost: 4000, source: 'correction' }
		];
		const model = fitDeliveryModel(perverse);
		expect(model.ratePerKmNS).toBeGreaterThanOrEqual(0);
		expect(model.ratePerKmEW).toBeGreaterThanOrEqual(0);
	});

	it('moves the estimate towards a correction for that address', () => {
		const address = { calle: '104', carrera: '18a', numero: 52 };
		const before = estimateDelivery(address, BASELINE_MODEL)!.cost;

		// Ops history says this address really costs 3,000; the baseline overshoots.
		const corrected = fitDeliveryModel([
			...SEED_OBSERVATIONS,
			{ ...address, actualCost: 3000, source: 'correction' },
			{ ...address, actualCost: 3000, source: 'correction' }
		]);
		const after = estimateDelivery(address, corrected)!.cost;

		expect(Math.abs(after - 3000)).toBeLessThan(Math.abs(before - 3000));
	});
});

describe('formatAddress', () => {
	it('writes the address the Colombian way', () => {
		expect(formatAddress({ calle: '146', carrera: '21', numero: 86 })).toBe('Calle 146 # 21-86');
	});
});

describe('calibration storage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('starts empty', () => {
		expect(loadCorrections()).toEqual([]);
	});

	it('persists a correction and reloads it', () => {
		addCorrection({ calle: '146', carrera: '21', numero: 86 }, 3700);
		const stored = loadCorrections();
		expect(stored).toHaveLength(1);
		expect(stored[0]).toMatchObject({ calle: '146', actualCost: 3700, source: 'correction' });
		expect(stored[0].recordedAt).toBeTruthy();
	});

	it('appends the corrections to the seed set for fitting', () => {
		addCorrection({ calle: '146', carrera: '21', numero: 86 }, 3700);
		const corrections = loadCorrections();
		expect(calibrationSet(corrections)).toHaveLength(SEED_OBSERVATIONS.length + 1);
		expect(currentModel(corrections).ratePerKmNS).toBeGreaterThan(0);
	});

	it('removes a single correction by index', () => {
		addCorrection({ calle: '146', carrera: '21', numero: 86 }, 3700);
		addCorrection({ calle: '119', carrera: '14', numero: 16 }, 2800);
		const left = removeCorrection(0);
		expect(left).toHaveLength(1);
		expect(left[0].calle).toBe('119');
	});

	it('clears everything back to the seed-only model', () => {
		addCorrection({ calle: '146', carrera: '21', numero: 86 }, 3700);
		expect(clearCorrections()).toEqual([]);
		expect(loadCorrections()).toEqual([]);
	});

	it('round-trips through export and import', () => {
		addCorrection({ calle: '146', carrera: '21', numero: 86 }, 3700);
		const json = exportCorrections(loadCorrections());

		clearCorrections();
		const result = importCorrections(json);
		expect(result.added).toBe(1);
		expect(result.corrections[0].actualCost).toBe(3700);
	});

	it('skips rows already present when the same file is imported twice', () => {
		addCorrection({ calle: '146', carrera: '21', numero: 86 }, 3700);
		const json = exportCorrections(loadCorrections());

		const result = importCorrections(json);
		expect(result.added).toBe(0);
		expect(result.corrections).toHaveLength(1);
	});

	it('drops malformed rows instead of failing the import', () => {
		const json = JSON.stringify({
			version: 1,
			corrections: [
				{ calle: '146', carrera: '21', numero: 86, actualCost: 3700 },
				{ calle: 'nonsense', carrera: '21', numero: 86, actualCost: 3700 },
				{ calle: '146', carrera: '21', numero: 86, actualCost: -100 }
			]
		});
		expect(importCorrections(json).corrections).toHaveLength(1);
	});

	it('recovers from corrupt storage', () => {
		localStorage.setItem('aristaeus.delivery.calibration.v1', 'not json');
		expect(loadCorrections()).toEqual([]);
	});
});
