import { describe, it, expect } from 'vitest';
import {
	haversineLegs,
	solveWeightedRidge,
	fitDeliveryModel,
	estimateFromLegs,
	rawCost,
	looCvMae,
	SEED_OBSERVATIONS,
	seedAddressText,
	CARRERA_BEARING_DEG,
	FALLBACK_MODEL,
	type LegObservation
} from '../model.js';
import { KITCHEN_ORIGIN } from '../geocode.js';

const seed = (northKm: number, eastKm: number, actualCost: number): LegObservation => ({
	northKm,
	eastKm,
	actualCost,
	source: 'seed'
});

describe('haversineLegs', () => {
	it('is zero for the same point', () => {
		expect(haversineLegs(KITCHEN_ORIGIN, KITCHEN_ORIGIN)).toEqual({ northKm: 0, eastKm: 0 });
	});

	it('is symmetric, since legs are absolute distances', () => {
		const a = { lat: 4.7, lng: -74.05 };
		const b = { lat: 4.73, lng: -74.08 };
		expect(haversineLegs(a, b)).toEqual(haversineLegs(b, a));
	});

	it('measures a pure meridian delta at roughly 111 km per degree', () => {
		const legs = haversineLegs({ lat: 4.7, lng: -74.05 }, { lat: 4.8, lng: -74.05 });
		// The legs are an orthogonal decomposition, so their Euclidean norm is
		// the true ground distance (their *sum* is the longer Manhattan path).
		const straightLine = Math.hypot(legs.northKm, legs.eastKm);
		expect(straightLine).toBeGreaterThan(11.0);
		expect(straightLine).toBeLessThan(11.2);
	});

	// The city grid is rotated ~24 degrees, so a pure north move is not a pure
	// carrera-axis move.
	it('rotates the delta into the city grid', () => {
		const legs = haversineLegs({ lat: 4.7, lng: -74.05 }, { lat: 4.8, lng: -74.05 });
		const theta = (CARRERA_BEARING_DEG * Math.PI) / 180;
		// A pure-north delta projects onto the carrera axis by sin(theta).
		expect(legs.northKm / (legs.northKm + legs.eastKm)).toBeCloseTo(
			Math.sin(theta) / (Math.sin(theta) + Math.cos(theta)),
			6
		);
	});

	it('places the kitchen-to-Calle-146 leg mostly on the carrera axis', () => {
		// CL 146 / 21 16, verified against the cadastre.
		const legs = haversineLegs(KITCHEN_ORIGIN, { lat: 4.728698, lng: -74.048 });
		expect(legs.northKm).toBeGreaterThan(legs.eastKm);
		expect(legs.northKm).toBeCloseTo(2.48, 1);
	});
});

describe('solveWeightedRidge', () => {
	it('approximately recovers known coefficients from clean data', () => {
		const rows: number[][] = [];
		for (let north = 0; north <= 10; north++) {
			for (let east = 0; east <= 10; east++) rows.push([1, north, east]);
		}
		const targets = rows.map((r) => 2000 + 900 * r[1] + 1500 * r[2]);
		const solution = solveWeightedRidge(
			rows,
			targets,
			rows.map(() => 1)
		)!;
		// The ridge shrinks the slopes slightly; with a large design that bias
		// is well under 1%.
		expect(Math.abs(solution[0] - 2000)).toBeLessThan(20);
		expect(Math.abs(solution[1] - 900)).toBeLessThan(20);
		expect(Math.abs(solution[2] - 1500)).toBeLessThan(20);
	});

	it('shrinks the slopes rather than exploding on a degenerate design', () => {
		// Two identical rows would be singular without the ridge term; the ridge
		// exists precisely so this stays solvable.
		const rows = [
			[1, 1, 1],
			[1, 1, 1]
		];
		const solution = solveWeightedRidge(rows, [3000, 3000], [1, 1])!;
		expect(solution).not.toBeNull();
		expect(solution.every((value) => Number.isFinite(value))).toBe(true);
	});

	it('returns null when even the intercept column is degenerate', () => {
		// The ridge penalises the slopes only, so an all-zero design has no
		// pivot on the intercept and must fail rather than divide by zero.
		const rows = [
			[0, 0, 0],
			[0, 0, 0]
		];
		expect(solveWeightedRidge(rows, [1, 1], [1, 1])).toBeNull();
	});

	it('returns null with no rows', () => {
		expect(solveWeightedRidge([], [], [])).toBeNull();
	});
});

describe('fitDeliveryModel', () => {
	it('falls back when there are too few observations', () => {
		const model = fitDeliveryModel([seed(1, 1, 3000), seed(2, 2, 4000)]);
		expect(model.intercept).toBe(FALLBACK_MODEL.intercept);
		// The min fare is still the cheapest real delivery.
		expect(model.minFare).toBe(3000);
	});

	it('uses the fallback min fare with no observations at all', () => {
		expect(fitDeliveryModel([])).toEqual(FALLBACK_MODEL);
	});

	it('sets the min fare to the cheapest observed delivery', () => {
		const model = fitDeliveryModel([
			seed(0.1, 0.1, 2800),
			seed(1, 1, 4000),
			seed(2, 1, 5000),
			seed(3, 2, 7000),
			seed(5, 1, 9000)
		]);
		expect(model.minFare).toBe(2800);
	});

	it('clamps negative slopes to zero', () => {
		// Cost falling with distance would otherwise produce a negative rate.
		const model = fitDeliveryModel([
			seed(1, 0, 9000),
			seed(2, 0, 7000),
			seed(3, 0, 5000),
			seed(4, 0, 3000),
			seed(5, 0, 2000)
		]);
		expect(model.ratePerKmNS).toBeGreaterThanOrEqual(0);
		expect(model.ratePerKmEW).toBeGreaterThanOrEqual(0);
	});

	it('weights corrections above seed rows', () => {
		const base: LegObservation[] = [
			seed(1, 0, 3000),
			seed(2, 0, 4000),
			seed(3, 0, 5000),
			seed(4, 0, 6000)
		];
		const withSeed = fitDeliveryModel([...base, seed(5, 0, 20000)]);
		const withCorrection = fitDeliveryModel([
			...base,
			{ northKm: 5, eastKm: 0, actualCost: 20000, source: 'correction' }
		]);
		// The same outlier pulls the fit harder when it is a correction.
		expect(withCorrection.ratePerKmNS).toBeGreaterThan(withSeed.ratePerKmNS);
	});

	it('ignores rows with non-finite values', () => {
		const model = fitDeliveryModel([
			seed(1, 0, 3000),
			seed(2, 0, 4000),
			seed(3, 0, 5000),
			seed(4, 0, 6000),
			seed(NaN, 0, 9000),
			seed(1, 0, Number.POSITIVE_INFINITY)
		]);
		expect(Number.isFinite(model.intercept)).toBe(true);
		expect(model.minFare).toBe(3000);
	});
});

describe('estimateFromLegs', () => {
	const model = { intercept: 2000, ratePerKmNS: 900, ratePerKmEW: 1500, minFare: 2800 };

	it('rounds to the nearest 100 COP', () => {
		const estimate = estimateFromLegs(model, { northKm: 1, eastKm: 1 });
		expect(estimate.cost % 100).toBe(0);
		expect(estimate.cost).toBe(4400);
	});

	it('applies the minimum fare floor and flags it', () => {
		const estimate = estimateFromLegs(model, { northKm: 0, eastKm: 0 });
		expect(estimate.cost).toBe(2800);
		expect(estimate.minFareApplied).toBe(true);
	});

	it('does not flag the floor when the raw cost clears it', () => {
		const estimate = estimateFromLegs(model, { northKm: 5, eastKm: 5 });
		expect(estimate.minFareApplied).toBe(false);
	});

	it('reports totalKm as the sum of the legs', () => {
		const estimate = estimateFromLegs(model, { northKm: 2, eastKm: 3 });
		expect(estimate.totalKm).toBe(5);
	});

	it('agrees with rawCost before rounding and flooring', () => {
		expect(rawCost(model, 2, 3)).toBe(2000 + 1800 + 4500);
	});
});

describe('looCvMae', () => {
	it('needs enough observations to leave one out', () => {
		expect(looCvMae([seed(1, 1, 3000), seed(2, 2, 4000)])).toBeNull();
	});

	// Held-out error is what the figure is for: noisy prices must score worse
	// than prices that sit on a straight line.
	it('scores noisy observations worse than collinear ones', () => {
		const line = [1, 2, 3, 4, 5, 6].map((km) => seed(km, 0, 2000 + 500 * km));
		const noisy = line.map((o, i) => (i === 3 ? seed(o.northKm, 0, 6000) : o));
		expect(looCvMae(noisy)!).toBeGreaterThan(looCvMae(line)!);
	});
});

describe('seed data', () => {
	it('carries all 20 Ops observations', () => {
		expect(SEED_OBSERVATIONS).toHaveLength(20);
	});

	it('renders each seed as a parseable address', () => {
		expect(seedAddressText(SEED_OBSERVATIONS[0])).toBe('Calle 146 # 21-86');
		expect(seedAddressText({ calle: '153', carrera: '14bis', numero: 81 })).toBe(
			'Calle 153 # 14bis-81'
		);
	});
});
