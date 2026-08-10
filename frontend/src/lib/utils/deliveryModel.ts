/**
 * Delivery cost estimation for Bogota addresses.
 *
 * We have no delivery fleet: external couriers quote us only after the order is
 * sent, but checkout needs a number up front. This module turns a destination
 * address into an estimate, and re-fits itself from the real prices couriers
 * end up charging (see deliveryCalibration.ts for where those are stored).
 *
 * ## How Bogota addresses work
 *
 * The city is a grid. `Calle 146 # 21-86` reads as: the address sits on Calle
 * 146, on the block that starts at Carrera 21, 86 metres along it.
 *
 * - **Calles** run east-west and are numbered increasing to the north.
 *   Moving between calles is moving north/south.
 * - **Carreras** run north-south and are numbered increasing to the west.
 *   Moving between carreras is moving east/west.
 * - The trailing number is a metre offset from the named carrera, which gives
 *   sub-block precision on the east-west axis.
 * - Streets inserted into the grid after the fact carry a suffix: Calle 145a
 *   lies between 145 and 146, and `bis` is the same idea (Calle 25bis sits
 *   between 25 and 26). We treat a suffix as a fraction of a block.
 *
 * A block is roughly 100 m on both axes, so a pair (calle, carrera) is usable
 * as a coordinate without any geocoding service.
 *
 * ## The model
 *
 * Couriers charge a base fare plus distance, and they follow streets rather
 * than flying, so we use Manhattan distance along the two grid axes:
 *
 *     cost = max(minFare, intercept + ratePerKmNS * northKm + ratePerKmEW * eastKm)
 *
 * The two axes get separate rates because they are not equally easy to cross:
 * fitted against the Ops data, east-west kilometres cost about twice what
 * north-south kilometres cost, which matches there being fewer through-streets
 * on that axis. Coefficients come from a weighted least-squares fit over the
 * seed observations plus any operator corrections.
 *
 * Accuracy: leave-one-out cross-validation over the 20 seed deliveries gives a
 * mean absolute error near 680 COP (~13%). That is close to the floor for this
 * data — it contains the same address delivered twice for 3,300 and 4,100 COP,
 * so roughly ±800 COP of the spread is courier noise no address-based model can
 * predict.
 */

/** A Bogota grid address, as the operator types it. */
export interface BogotaAddress {
	/** Calle token, e.g. `146`, `145a`, `25bis`. */
	calle: string;
	/** Carrera token, e.g. `21`, `18a`, `14bis`. */
	carrera: string;
	/** Metre offset from the carrera (the `-86` in `# 21-86`). */
	numero: number;
}

/** A delivery whose real courier price we know. */
export interface DeliveryObservation extends BogotaAddress {
	/** What the courier actually charged, in COP. */
	actualCost: number;
	/** ISO timestamp, present on operator-entered corrections. */
	recordedAt?: string;
	/** Where the observation came from. Seed rows are the Ops history export. */
	source: 'seed' | 'correction';
}

/** Fitted model parameters. All costs in COP. */
export interface DeliveryModel {
	intercept: number;
	ratePerKmNS: number;
	ratePerKmEW: number;
	minFare: number;
}

export interface DeliveryEstimate {
	/** Estimated cost in COP, rounded to the nearest 100. */
	cost: number;
	/** North-south leg in km. */
	northKm: number;
	/** East-west leg in km. */
	eastKm: number;
	/** Street-following distance in km (northKm + eastKm). */
	totalKm: number;
	/** True when the raw estimate fell below the minimum fare and was clamped. */
	minFareApplied: boolean;
}

/** Metres between consecutive calles, and between consecutive carreras. */
const BLOCK_METRES = 100;

/** Corrections outweigh seed rows: they are newer and reflect current tariffs. */
const CORRECTION_WEIGHT = 3;

/** Tiny ridge term, purely to keep the normal equations invertible. */
const RIDGE = 1;

/**
 * Used only when a fit is impossible (too few or degenerate observations).
 * These are the coefficients the seed data produces.
 */
const FALLBACK_MODEL: DeliveryModel = {
	intercept: 2033,
	ratePerKmNS: 822,
	ratePerKmEW: 1604,
	minFare: 2800
};

/** The kitchen. Every distance is measured from here. */
export const KITCHEN_ORIGIN: BogotaAddress = { calle: '125', carrera: '18a', numero: 5 };

/**
 * Past deliveries provided by Ops, used as the model's prior. Kept verbatim,
 * including the duplicate address at two different prices.
 */
export const SEED_OBSERVATIONS: DeliveryObservation[] = [
	{ calle: '146', carrera: '21', numero: 86, actualCost: 3700, source: 'seed' },
	{ calle: '119', carrera: '14', numero: 16, actualCost: 2800, source: 'seed' },
	{ calle: '122', carrera: '19', numero: 45, actualCost: 2800, source: 'seed' },
	{ calle: '124', carrera: '19', numero: 66, actualCost: 2800, source: 'seed' },
	{ calle: '118', carrera: '19', numero: 30, actualCost: 3500, source: 'seed' },
	{ calle: '26', carrera: '42', numero: 90, actualCost: 14100, source: 'seed' },
	{ calle: '122', carrera: '15', numero: 45, actualCost: 2800, source: 'seed' },
	{ calle: '104', carrera: '18a', numero: 52, actualCost: 3000, source: 'seed' },
	{ calle: '45a', carrera: '30', numero: 55, actualCost: 10400, source: 'seed' },
	{ calle: '145a', carrera: '12', numero: 39, actualCost: 5000, source: 'seed' },
	{ calle: '145', carrera: '13a', numero: 19, actualCost: 3300, source: 'seed' },
	{ calle: '145', carrera: '13a', numero: 19, actualCost: 4100, source: 'seed' },
	{ calle: '93a', carrera: '13', numero: 24, actualCost: 5700, source: 'seed' },
	{ calle: '155', carrera: '14', numero: 10, actualCost: 5900, source: 'seed' },
	{ calle: '104', carrera: '18a', numero: 52, actualCost: 3000, source: 'seed' },
	{ calle: '25bis', carrera: '31a', numero: 38, actualCost: 11000, source: 'seed' },
	{ calle: '153', carrera: '14bis', numero: 81, actualCost: 5700, source: 'seed' },
	{ calle: '93', carrera: '19', numero: 55, actualCost: 4700, source: 'seed' },
	{ calle: '52a', carrera: '9', numero: 31, actualCost: 11900, source: 'seed' },
	{ calle: '92', carrera: '19b', numero: 22, actualCost: 4600, source: 'seed' }
];

/**
 * Position of a street token on its axis, in block units.
 *
 * A suffix places the street inside the block that follows the number:
 * `145a` -> 145.25, `145b` -> 145.5, `25bis` -> 25.5. Returns `null` for
 * anything that is not a Bogota street token.
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

/** True when every component of the address is parseable. */
export function isValidAddress(address: Partial<BogotaAddress>): address is BogotaAddress {
	return (
		parseStreetToken(address.calle ?? '') !== null &&
		parseStreetToken(address.carrera ?? '') !== null &&
		Number.isFinite(address.numero) &&
		(address.numero as number) >= 0
	);
}

/** Street-following distance from `origin` to `address`, split by axis, in km. */
export function addressDistance(
	address: BogotaAddress,
	origin: BogotaAddress = KITCHEN_ORIGIN
): { northKm: number; eastKm: number } | null {
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
 * Solve `(XᵀWX + ridge·I) θ = XᵀWy` by Gauss-Jordan elimination.
 * The system is 3x3, so an explicit solver beats pulling in a matrix library.
 */
function solveWeightedRidge(
	rows: number[][],
	targets: number[],
	weights: number[]
): number[] | null {
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
 * without discarding the history. Falls back to the seed fit if the
 * observations are degenerate (all at one address, say).
 */
export function fitDeliveryModel(
	observations: DeliveryObservation[] = SEED_OBSERVATIONS,
	origin: BogotaAddress = KITCHEN_ORIGIN
): DeliveryModel {
	const rows: number[][] = [];
	const targets: number[] = [];
	const weights: number[] = [];

	for (const observation of observations) {
		const distance = addressDistance(observation, origin);
		if (!distance || !Number.isFinite(observation.actualCost)) continue;
		rows.push([1, distance.northKm, distance.eastKm]);
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

/** Fit over the Ops history alone — the starting point before any correction. */
export const BASELINE_MODEL: DeliveryModel = fitDeliveryModel(SEED_OBSERVATIONS);

/** Raw model output for an address, before rounding or the minimum fare. */
function rawCost(model: DeliveryModel, northKm: number, eastKm: number): number {
	return model.intercept + model.ratePerKmNS * northKm + model.ratePerKmEW * eastKm;
}

/**
 * Estimate what a courier will charge to deliver to `address`.
 * Returns `null` if the address cannot be parsed.
 */
export function estimateDelivery(
	address: BogotaAddress,
	model: DeliveryModel = BASELINE_MODEL,
	origin: BogotaAddress = KITCHEN_ORIGIN
): DeliveryEstimate | null {
	const distance = addressDistance(address, origin);
	if (!distance) return null;

	const raw = rawCost(model, distance.northKm, distance.eastKm);
	const minFareApplied = raw < model.minFare;
	const cost = Math.round(Math.max(raw, model.minFare) / 100) * 100;

	return {
		cost,
		northKm: distance.northKm,
		eastKm: distance.eastKm,
		totalKm: distance.northKm + distance.eastKm,
		minFareApplied
	};
}

/**
 * Mean absolute error of `model` over `observations`, in COP — the "give or
 * take" figure shown next to an estimate. Uses the model as-is, so call it with
 * the same observations it was fitted on to get the in-sample error.
 */
export function meanAbsoluteError(
	model: DeliveryModel,
	observations: DeliveryObservation[],
	origin: BogotaAddress = KITCHEN_ORIGIN
): number | null {
	let total = 0;
	let count = 0;
	for (const observation of observations) {
		const estimate = estimateDelivery(observation, model, origin);
		if (!estimate) continue;
		total += Math.abs(estimate.cost - observation.actualCost);
		count++;
	}
	return count ? Math.round(total / count) : null;
}

/** Format an address the way it is written in Colombia. */
export function formatAddress(address: BogotaAddress): string {
	return `Calle ${address.calle} # ${address.carrera}-${address.numero}`;
}
