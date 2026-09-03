/**
 * Delivery cost model.
 *
 * We have no delivery fleet: a third-party courier app quotes us only after
 * the order is sent, so this module predicts *what the courier will charge*.
 * The recorded actual charge is the ground truth.
 *
 * ## The model
 *
 * Couriers charge a base fare plus distance, and they follow streets rather
 * than flying, so cost is linear in two orthogonal legs:
 *
 *     cost = max(minFare, intercept + ratePerKmNS * northKm + ratePerKmEW * eastKm)
 *
 * The axes get separate rates because Bogota travel is genuinely anisotropic —
 * there are fewer through-streets east-west — and the fitted slopes also
 * absorb the road detour factor (~1.2-1.5x great-circle) without needing a
 * routing API.
 *
 * ## What changed in v2
 *
 * v1 *invented* the legs: it mapped `calle`/`carrera` tokens to numbers and
 * multiplied by a flat 100 m per block. Bogota's block spacing is nowhere near
 * uniform, so those legs were wrong before the regression ever saw them.
 *
 * v2 measures the legs from real cadastral coordinates (see `geocode.ts`) via
 * {@link haversineLegs}. The regression itself is unchanged — it was never the
 * problem.
 *
 * The v1 grid math is retained at the bottom of this file as the labelled
 * `grid_fallback` path, used only when geocoding fails outright.
 *
 * ## Accuracy reporting
 *
 * The user-facing "give or take" figure is **leave-one-out cross-validated**
 * MAE ({@link looCvMae}), not in-sample MAE. With 20 observations and 3 free
 * parameters, in-sample error flatters the model badly.
 */

import type { LatLng } from './geocode.js';

/** Corrections outweigh seed rows: they are newer and reflect current tariffs. */
export const CORRECTION_WEIGHT = 3;

/** Tiny ridge term, purely to keep the normal equations invertible. */
export const RIDGE = 1;

/** Mean Earth radius (IUGG), km. */
const EARTH_RADIUS_KM = 6371.0088;

/**
 * Bearing of Bogota's carrera axis, in degrees counter-clockwise from true
 * east. The city grid is **rotated ~24 degrees** from true north, so splitting
 * a delta into true north/east would mix the two travel axes together and
 * destroy the anisotropy the model relies on.
 *
 * Measured directly from the cadastral plate geometry: for each carrera, the
 * principal axis of its plate cloud gives the street's bearing. Length-weighted
 * over the long, straight carreras (`straightness` > 0.96, extent > 4 km):
 *
 *     KR 7  68.79   KR 9  66.69   KR 11 68.77   KR 13 69.87
 *     KR 15 63.35   KR 19 62.87   KR 50 66.32   KR 68 59.23
 *     -> length-weighted mean 65.76 degrees
 *
 * Calles measure perpendicular to this (-10 to -34 from east), confirming the
 * axes are genuinely orthogonal.
 *
 * Caveat: the colonial centre is on a differently-rotated grid (KR 24 measures
 * 43.6, KR 30 measures 33.5), and Carrera 7 bends nearly east-west north of
 * Calle 170 (`AK 7` measures 87.9). Those zones carry extra error, which is
 * exactly what the cross-validated MAE is there to expose.
 */
export const CARRERA_BEARING_DEG = 66;

/** Fitted model parameters. All costs in COP. */
export interface DeliveryModel {
	intercept: number;
	ratePerKmNS: number;
	ratePerKmEW: number;
	minFare: number;
}

/** The two orthogonal legs of a delivery, in km. */
export interface Legs {
	northKm: number;
	eastKm: number;
}

/** A delivery whose real courier charge we know, reduced to model inputs. */
export interface LegObservation extends Legs {
	actualCost: number;
	source: 'seed' | 'correction';
}

export interface DeliveryEstimate {
	/** Estimated cost in COP, rounded to the nearest 100. */
	cost: number;
	northKm: number;
	eastKm: number;
	/** Street-following distance in km (northKm + eastKm). */
	totalKm: number;
	/** True when the raw estimate fell below the minimum fare and was clamped. */
	minFareApplied: boolean;
}

/**
 * Used only when a fit is impossible (too few or degenerate observations).
 * These are the coefficients the original seed data produced.
 */
export const FALLBACK_MODEL: DeliveryModel = {
	intercept: 2033,
	ratePerKmNS: 822,
	ratePerKmEW: 1604,
	minFare: 2800
};

// ============================================
// Distance
// ============================================

/**
 * Decompose the origin -> destination delta into the two travel axes, in km.
 *
 * First the delta is measured on the ground: the latitude difference is a
 * meridian arc, and the longitude difference is a parallel arc scaled by
 * `cos(latitude)` (at Bogota's 4.7 degrees that correction is only 0.34%, but
 * it costs nothing to be right).
 *
 * Then the pair is **rotated into the city grid** by
 * {@link CARRERA_BEARING_DEG}, so that:
 *
 * - `northKm` is distance along the carrera axis (crossing calles), and
 * - `eastKm` is distance along the calle axis (crossing carreras).
 *
 * Without this rotation the two legs are cross-contaminated and the fitted
 * per-axis rates become meaningless — it is worth roughly 225 COP of
 * cross-validated MAE on the seed set.
 */
export function haversineLegs(from: LatLng, to: LatLng): Legs {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const meanLat = toRad((from.lat + to.lat) / 2);

	const deltaNorthKm = toRad(to.lat - from.lat) * EARTH_RADIUS_KM;
	const deltaEastKm = toRad(to.lng - from.lng) * EARTH_RADIUS_KM * Math.cos(meanLat);

	const theta = toRad(CARRERA_BEARING_DEG);
	const alongCarrera = deltaEastKm * Math.cos(theta) + deltaNorthKm * Math.sin(theta);
	const alongCalle = -deltaEastKm * Math.sin(theta) + deltaNorthKm * Math.cos(theta);

	return { northKm: Math.abs(alongCarrera), eastKm: Math.abs(alongCalle) };
}

// ============================================
// Fitting
// ============================================

/**
 * Solve `(XᵀWX + ridge·I) θ = XᵀWy` by Gauss-Jordan elimination.
 * The system is 3x3, so an explicit solver beats pulling in a matrix library.
 */
export function solveWeightedRidge(
	rows: number[][],
	targets: number[],
	weights: number[]
): number[] | null {
	if (rows.length === 0) return null;
	const size = rows[0].length;
	const normal: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
	const rhs = new Array(size).fill(0);

	for (let i = 0; i < rows.length; i++) {
		for (let r = 0; r < size; r++) {
			for (let c = 0; c < size; c++) normal[r][c] += weights[i] * rows[i][r] * rows[i][c];
			rhs[r] += weights[i] * rows[i][r] * targets[i];
		}
	}
	// Penalise the slopes only; the intercept should stay free.
	for (let r = 1; r < size; r++) normal[r][r] += RIDGE;

	for (let col = 0; col < size; col++) {
		let pivot = col;
		for (let r = col + 1; r < size; r++) {
			if (Math.abs(normal[r][col]) > Math.abs(normal[pivot][col])) pivot = r;
		}
		if (Math.abs(normal[pivot][col]) < 1e-9) return null;
		[normal[col], normal[pivot]] = [normal[pivot], normal[col]];
		[rhs[col], rhs[pivot]] = [rhs[pivot], rhs[col]];

		for (let r = 0; r < size; r++) {
			if (r === col) continue;
			const factor = normal[r][col] / normal[col][col];
			for (let c = col; c < size; c++) normal[r][c] -= factor * normal[col][c];
			rhs[r] -= factor * rhs[col];
		}
	}

	return rhs.map((value, i) => value / normal[i][i]);
}

/**
 * Fit the model to a set of observations. Operator corrections are weighted
 * more heavily than seed rows, so a handful of fresh prices can pull the model
 * without discarding the history. Falls back to {@link FALLBACK_MODEL} if the
 * observations are degenerate (all at one address, say).
 */
export function fitDeliveryModel(observations: LegObservation[]): DeliveryModel {
	const rows: number[][] = [];
	const targets: number[] = [];
	const weights: number[] = [];

	for (const observation of observations) {
		if (
			!Number.isFinite(observation.northKm) ||
			!Number.isFinite(observation.eastKm) ||
			!Number.isFinite(observation.actualCost)
		) {
			continue;
		}
		rows.push([1, observation.northKm, observation.eastKm]);
		targets.push(observation.actualCost);
		weights.push(observation.source === 'correction' ? CORRECTION_WEIGHT : 1);
	}

	// The minimum fare is whatever the cheapest real delivery cost us.
	const minFare = targets.length ? Math.min(...targets) : FALLBACK_MODEL.minFare;

	if (rows.length < 4) return { ...FALLBACK_MODEL, minFare };

	const solution = solveWeightedRidge(rows, targets, weights);
	if (!solution || solution.some((value) => !Number.isFinite(value))) {
		return { ...FALLBACK_MODEL, minFare };
	}

	const [intercept, ratePerKmNS, ratePerKmEW] = solution;
	return {
		intercept,
		// A negative rate would mean distance makes delivery cheaper; clamp it away.
		ratePerKmNS: Math.max(0, ratePerKmNS),
		ratePerKmEW: Math.max(0, ratePerKmEW),
		minFare
	};
}

// ============================================
// Prediction
// ============================================

/** Raw model output, before rounding or the minimum fare. */
export function rawCost(model: DeliveryModel, northKm: number, eastKm: number): number {
	return model.intercept + model.ratePerKmNS * northKm + model.ratePerKmEW * eastKm;
}

/** Estimate what a courier will charge for a delivery with the given legs. */
export function estimateFromLegs(model: DeliveryModel, legs: Legs): DeliveryEstimate {
	const raw = rawCost(model, legs.northKm, legs.eastKm);
	const minFareApplied = raw < model.minFare;
	const cost = Math.round(Math.max(raw, model.minFare) / 100) * 100;

	return {
		cost,
		northKm: legs.northKm,
		eastKm: legs.eastKm,
		totalKm: legs.northKm + legs.eastKm,
		minFareApplied
	};
}

/**
 * In-sample mean absolute error, in COP. Kept for diagnostics and for the
 * v1-vs-v2 comparison; do **not** show it to users — use {@link looCvMae}.
 */
export function meanAbsoluteError(
	model: DeliveryModel,
	observations: LegObservation[]
): number | null {
	if (observations.length === 0) return null;
	const total = observations.reduce(
		(sum, observation) =>
			sum + Math.abs(estimateFromLegs(model, observation).cost - observation.actualCost),
		0
	);
	return Math.round(total / observations.length);
}

/**
 * Leave-one-out cross-validated MAE, in COP — the honest "give or take"
 * figure. Each observation is predicted by a model fitted on the other N-1,
 * so the error reflects performance on an address the model has not seen.
 *
 * Returns `null` when there are too few observations to leave one out and
 * still fit (the fit needs 4 rows, so N must exceed 4).
 */
export function looCvMae(observations: LegObservation[]): number | null {
	const usable = observations.filter(
		(observation) =>
			Number.isFinite(observation.northKm) &&
			Number.isFinite(observation.eastKm) &&
			Number.isFinite(observation.actualCost)
	);
	if (usable.length < 5) return null;

	let total = 0;
	for (let i = 0; i < usable.length; i++) {
		const heldOut = usable[i];
		const rest = usable.filter((_, index) => index !== i);
		const model = fitDeliveryModel(rest);
		total += Math.abs(estimateFromLegs(model, heldOut).cost - heldOut.actualCost);
	}
	return Math.round(total / usable.length);
}

// ============================================
// v1 grid fallback
// ============================================

/**
 * The original synthetic-grid geometry, retained *only* as the degraded path
 * used when the cadastral service cannot resolve an address. Results computed
 * this way must always be labelled `grid_fallback`.
 *
 * Its flaw is documented at the top of this file: it assumes a uniform 100 m
 * block, which Bogota does not have.
 */
const BLOCK_METRES = 100;

/** A Bogota grid address in v1's vocabulary. */
export interface GridAddress {
	calle: string;
	carrera: string;
	numero: number;
}

/** The kitchen, in v1 grid terms: Calle 125 # 18A-05. */
export const GRID_ORIGIN: GridAddress = { calle: '125', carrera: '18a', numero: 5 };

/**
 * Position of a street token on its axis, in block units.
 *
 * A suffix places the street inside the block that follows the number:
 * `145a` -> 145.25, `25bis` -> 25.5. Returns `null` for anything that is not
 * a Bogota street token.
 */
export function parseStreetToken(token: string): number | null {
	const match = String(token ?? '')
		.trim()
		.toLowerCase()
		.match(/^(\d{1,3})\s*(bis|[a-h])?$/);
	if (!match) return null;

	const base = Number(match[1]);
	const suffix = match[2];
	if (!suffix) return base;
	// `bis` is a single insertion, so it sits mid-block.
	if (suffix === 'bis') return base + 0.5;
	// a, b, c... are evenly spread across the block, never reaching the next one.
	return base + (suffix.charCodeAt(0) - 96) / 4;
}

/** v1 street-following legs, from the synthetic grid. */
export function gridLegs(address: GridAddress, origin: GridAddress = GRID_ORIGIN): Legs | null {
	const calle = parseStreetToken(address.calle);
	const carrera = parseStreetToken(address.carrera);
	const originCalle = parseStreetToken(origin.calle);
	const originCarrera = parseStreetToken(origin.carrera);
	if (calle === null || carrera === null || originCalle === null || originCarrera === null) {
		return null;
	}

	// The trailing number is a metre offset along the east-west axis, so it
	// refines the carrera position rather than the calle position.
	const eastMetres = carrera * BLOCK_METRES + address.numero;
	const originEastMetres = originCarrera * BLOCK_METRES + origin.numero;

	return {
		northKm: (Math.abs(calle - originCalle) * BLOCK_METRES) / 1000,
		eastKm: Math.abs(eastMetres - originEastMetres) / 1000
	};
}

/**
 * The 20 past deliveries provided by Ops, kept verbatim — including the same
 * address recorded twice at 3,300 and 4,100 COP, which is why roughly +/-800
 * COP of the residual is courier noise no address-based model can predict.
 *
 * These seed `backend/prisma/seed-delivery.ts`, which geocodes each one so
 * seeds and corrections share a single coordinate basis.
 */
export const SEED_OBSERVATIONS: Array<GridAddress & { actualCost: number }> = [
	{ calle: '146', carrera: '21', numero: 86, actualCost: 3700 },
	{ calle: '119', carrera: '14', numero: 16, actualCost: 2800 },
	{ calle: '122', carrera: '19', numero: 45, actualCost: 2800 },
	{ calle: '124', carrera: '19', numero: 66, actualCost: 2800 },
	{ calle: '118', carrera: '19', numero: 30, actualCost: 3500 },
	{ calle: '26', carrera: '42', numero: 90, actualCost: 14100 },
	{ calle: '122', carrera: '15', numero: 45, actualCost: 2800 },
	{ calle: '104', carrera: '18a', numero: 52, actualCost: 3000 },
	{ calle: '45a', carrera: '30', numero: 55, actualCost: 10400 },
	{ calle: '145a', carrera: '12', numero: 39, actualCost: 5000 },
	{ calle: '145', carrera: '13a', numero: 19, actualCost: 3300 },
	{ calle: '145', carrera: '13a', numero: 19, actualCost: 4100 },
	{ calle: '93a', carrera: '13', numero: 24, actualCost: 5700 },
	{ calle: '155', carrera: '14', numero: 10, actualCost: 5900 },
	{ calle: '104', carrera: '18a', numero: 52, actualCost: 3000 },
	{ calle: '25bis', carrera: '31a', numero: 38, actualCost: 11000 },
	{ calle: '153', carrera: '14bis', numero: 81, actualCost: 5700 },
	{ calle: '93', carrera: '19', numero: 55, actualCost: 4700 },
	{ calle: '52a', carrera: '9', numero: 31, actualCost: 11900 },
	{ calle: '92', carrera: '19b', numero: 22, actualCost: 4600 }
];

/** Seed observations expressed as free-text addresses, for geocoding. */
export function seedAddressText(seed: GridAddress): string {
	return `Calle ${seed.calle} # ${seed.carrera}-${seed.numero}`;
}

/**
 * The v1 grid model, fitted on the seed observations' synthetic legs. Used to
 * price `grid_fallback` results, which are in grid-km and must never be
 * scored with the geocoded model's coefficients.
 */
export const GRID_MODEL: DeliveryModel = fitDeliveryModel(
	SEED_OBSERVATIONS.flatMap((seed) => {
		const legs = gridLegs(seed);
		return legs ? [{ ...legs, actualCost: seed.actualCost, source: 'seed' as const }] : [];
	})
);
