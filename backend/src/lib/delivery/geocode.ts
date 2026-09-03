/**
 * Geocoding against Bogota's official cadastral address-point service.
 *
 * `https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/catastro/
 *  placadomiciliaria/MapServer/0`
 *
 * Public, no API key, no quota. 1,772,872 address plates covering the urban
 * Distrito Capital, returned in WGS84 (EPSG:4326) with `maxRecordCount` 2000.
 *
 * ## Nomenclature rules, derived from probing the live service
 *
 * These were established empirically; each one is load-bearing and each one
 * corresponds to a real address that fails without it.
 *
 * ### 1. Avenue prefixes are a *separate* vocabulary, not a synonym
 *
 * A road numbered `26` may exist under `AC 26` (Avenida Calle) while `CL 26`
 * returns **zero** rows — Calle 26 (Avenida El Dorado) is filed exclusively as
 * `AC 26` (648 plates; `CL 26` has 0). Conversely Carrera 7 is *split*: `KR 7`
 * has 2189 plates and `AK 7` has 1193, covering different stretches.
 *
 * Most importantly the choice can vary **along one road**: Calle 153 exists as
 * both `CL 153` (its eastern and western segments, cross-streets 6, 72-74, 87A,
 * 118, 133-136) and `AC 153` (1188 plates, the central segment carrying
 * cross-streets 14-22). So the lookup must try both forms and keep whichever
 * yields a hit — see {@link viaCandidates}.
 *
 * ### 2. `BIS` in a *cross-street* is dropped by the cadastre
 *
 * `BIS` is glued in `PDONVIAL` (`CL 25BIS`, `KR 14BIS` — 195k plates), but in
 * the cross-street half of `PDOTEXTO` it is almost always simply **absent**.
 * `Calle 153 # 14bis-81` is filed as `AC 153` / `14 81`. Only 12 plates in the
 * entire 1.77M-row layer use a spaced `86 BIS 99` form. So cross-street
 * variants are tried in the order: as written, `BIS` removed, `BIS` spaced.
 *
 * ### 3. House numbers are zero-padded to two digits
 *
 * `18A 05`, `59A 08`, `65 01`. Rather than pad the query string, we fetch the
 * whole cross-street with `PDOTEXTO LIKE '<cross> %'` and compare house numbers
 * *numerically* after parsing — so `5` matches the stored `05` for free, and
 * the same single round-trip also supplies the `nearest_number` tier when the
 * exact number is absent.
 *
 * ### 4. Values carry trailing whitespace
 *
 * `"48A 92 "`, `"59A 08 "`. Every value read back is trimmed, and equality
 * lookups use `LIKE 'x%'` rather than `= 'x'` so a trailing space cannot cause
 * a false miss.
 *
 * ### 5. Cross-street numbering has real gaps
 *
 * `AC 26` has cross-streets 41 and 43 but **no 42**, so `Calle 26 # 42-90` can
 * never match exactly. Falling straight to a whole-street centroid would be
 * terrible here: `AC 26` spans lon -74.075 to -74.099, roughly 2.7 km. Instead
 * the `nearest_cross` tier picks the numerically closest cross-street on the
 * same road (41 or 43), which lands within ~150 m. This tier sits between
 * `nearest_number` and `street_segment`.
 *
 * ### 6. Cross-street tokens are not always numeric
 *
 * `MJ` (mejoras), `IN` (interior) and `TO` (torre) appear as cross-streets, and
 * `PDOTEXTO` is sometimes just `MJ` with no number. These are skipped rather
 * than parsed, and must never throw.
 */

import prisma from '../db.js';
import { addressCacheKey, type ParsedAddress, type StreetPrefix } from './address.js';

const SERVICE_URL =
	'https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/catastro/placadomiciliaria/MapServer/0/query';

/** The service has no SLA, so every individual call is bounded. */
const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Wall-clock budget for an entire geocode, across every query in the tier
 * ladder.
 *
 * **Do not raise this without reading the following.** API Gateway HTTP APIs
 * cap integration response time at **29 seconds**, and that is a hard AWS
 * service quota that cannot be increased by request. Exceeding it returns a
 * 504 to the operator with no useful diagnostics.
 *
 * The per-query timeout alone does not bound the total: the ladder issues up
 * to 8 queries sequentially (2 street-prefix candidates x up to 3 cross-street
 * variants, then up to 2 whole-road queries), so a pathological uncached
 * lookup could otherwise run ~48 s.
 *
 * 20 s leaves roughly 9 s of headroom for Lambda cold start, the Prisma
 * connection, the model fit and serialisation, all of which sit inside the
 * same 29 s window.
 */
export const TOTAL_BUDGET_MS = 20000;

/**
 * Below this much remaining budget a further query is not worth starting — it
 * would almost certainly be aborted mid-flight and only burn the remainder.
 */
const MIN_QUERY_BUDGET_MS = 750;

/** Service maxRecordCount. Requesting more is silently truncated anyway. */
const MAX_RECORDS = 2000;

/**
 * The kitchen: Calle 125 # 18A-05. Verified against the cadastre as
 * `CL 125` / `18A 05`. Every delivery distance is measured from here.
 */
export const KITCHEN_ORIGIN: LatLng = { lat: 4.704050239, lng: -74.047217558 };

export interface LatLng {
	lat: number;
	lng: number;
}

/**
 * How confident we are in the coordinates, in descending order. Never degrade
 * silently: the tier is always returned so the UI can label it.
 */
export type MatchTier =
	| 'exact'
	| 'nearest_number'
	| 'nearest_cross'
	| 'street_segment'
	| 'grid_fallback'
	| 'failed';

export interface GeocodeResult {
	lat: number;
	lng: number;
	matchTier: MatchTier;
	/** The `PDONVIAL / PDOTEXTO` actually matched, for display. */
	resolvedPlate: string | null;
	/** True when the coordinates came from the Postgres cache. */
	cached: boolean;
}

/**
 * The outcome of a geocode attempt.
 *
 * `searchTruncated` exists so a time-limited search can never masquerade as a
 * completed one. When it is true the ladder was cut short by
 * {@link TOTAL_BUDGET_MS} and tiers below the one reached were never explored,
 * so the caller must present the answer as provisional and worth retrying —
 * not as evidence that the address is absent from the cadastre.
 */
export interface GeocodeOutcome {
	result: GeocodeResult | null;
	searchTruncated: boolean;
}

/** One address plate from the cadastre. */
interface Plate {
	via: string;
	text: string;
	/** Cross-street token, e.g. `18A`. `null` when non-numeric junk. */
	cross: string | null;
	/** House number, `null` when absent or unparseable. */
	number: number | null;
	lat: number;
	lng: number;
}

/** ArcGIS returns `{ x: lng, y: lat }`. */
interface ArcGisFeature {
	attributes?: { PDONVIAL?: string | null; PDOTEXTO?: string | null };
	geometry?: { x?: number; y?: number } | null;
}

/** Escape a value for embedding in the service's SQL `where` clause. */
function sqlQuote(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Alternate `PDONVIAL` forms to try, in priority order.
 *
 * See rule 1 above: `CL` and `AC` are alternates of each other, as are `KR`
 * and `AK`. `DG` and `TV` have no avenue form.
 */
export function viaCandidates(address: ParsedAddress): string[] {
	const alternates: Record<StreetPrefix, StreetPrefix[]> = {
		CL: ['CL', 'AC'],
		AC: ['AC', 'CL'],
		KR: ['KR', 'AK'],
		AK: ['AK', 'KR'],
		DG: ['DG'],
		TV: ['TV']
	};
	return alternates[address.prefix].map((prefix) => `${prefix} ${address.street}`);
}

/**
 * Cross-street spellings to try, in priority order.
 *
 * See rule 2: the cadastre usually drops `BIS` from the cross-street, so
 * `14BIS` must also be tried as `14` and as `14 BIS`.
 */
export function crossCandidates(cross: string): string[] {
	const variants = [cross];
	if (cross.includes('BIS')) {
		variants.push(cross.replace(/BIS/g, ''));
		variants.push(cross.replace(/BIS/g, ' BIS'));
	}
	return variants.filter((value, index) => value !== '' && variants.indexOf(value) === index);
}

/** Split a `PDOTEXTO` value into cross-street and house number. Never throws. */
export function parsePlateText(text: string): { cross: string | null; number: number | null } {
	const parts = String(text ?? '')
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (parts.length === 0) return { cross: null, number: null };

	const last = parts[parts.length - 1];
	// A trailing all-digit token is the house number; anything else (`MJ`) is not.
	if (parts.length > 1 && /^\d+$/.test(last)) {
		return { cross: parts.slice(0, -1).join(' '), number: Number(last) };
	}
	return { cross: parts.join(' '), number: null };
}

/** Run one `where` query against the service and normalise the features. */
async function queryPlates(
	where: string,
	limit: number,
	timeoutMs: number,
	fetchImpl: typeof fetch
): Promise<Plate[]> {
	const params = new URLSearchParams({
		where,
		outFields: 'PDONVIAL,PDOTEXTO',
		returnGeometry: 'true',
		outSR: '4326',
		resultRecordCount: String(Math.min(limit, MAX_RECORDS)),
		f: 'pjson'
	});

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchImpl(`${SERVICE_URL}?${params.toString()}`, {
			signal: controller.signal
		});
		if (!response.ok) return [];

		const payload = (await response.json()) as { features?: ArcGisFeature[]; error?: unknown };
		if (payload.error || !Array.isArray(payload.features)) return [];

		const plates: Plate[] = [];
		for (const feature of payload.features) {
			const lng = feature.geometry?.x;
			const lat = feature.geometry?.y;
			if (typeof lng !== 'number' || typeof lat !== 'number') continue;

			// Rule 4: values carry trailing whitespace.
			const via = String(feature.attributes?.PDONVIAL ?? '').trim();
			const text = String(feature.attributes?.PDOTEXTO ?? '').trim();
			const { cross, number } = parsePlateText(text);
			plates.push({ via, text, cross, number, lat, lng });
		}
		return plates;
	} catch {
		// Timeout, abort, network error or malformed JSON — all mean "no match".
		return [];
	} finally {
		clearTimeout(timer);
	}
}

/** Numeric part of a cross-street token, for gap-bracketing. `18A` -> 18. */
function crossNumber(cross: string | null): number | null {
	if (!cross) return null;
	const match = /^(\d{1,3})/.exec(cross);
	return match ? Number(match[1]) : null;
}

function centroid(plates: Plate[]): LatLng {
	const lat = plates.reduce((sum, p) => sum + p.lat, 0) / plates.length;
	const lng = plates.reduce((sum, p) => sum + p.lng, 0) / plates.length;
	return { lat, lng };
}

export interface GeocodeOptions {
	/** Per-query timeout. Also clamped by whatever budget remains. */
	timeoutMs?: number;
	/** Wall-clock budget for the whole ladder. See {@link TOTAL_BUDGET_MS}. */
	totalBudgetMs?: number;
	fetchImpl?: typeof fetch;
	/** Skip the Postgres cache entirely (used by tests and the seeder). */
	useCache?: boolean;
}

/**
 * Tracks the wall-clock budget shared by every query in one geocode.
 *
 * `next()` returns the timeout to use for the next query, or `null` when the
 * budget is spent and the ladder must stop descending.
 */
class Budget {
	private readonly deadline: number;
	/** Set once a query has been declined for lack of budget. */
	truncated = false;

	constructor(
		totalMs: number,
		private readonly perQueryMs: number
	) {
		this.deadline = Date.now() + totalMs;
	}

	next(): number | null {
		const remaining = this.deadline - Date.now();
		// Never demand more headroom than a single query would take anyway,
		// otherwise a short per-query timeout could never start at all.
		const floor = Math.min(MIN_QUERY_BUDGET_MS, this.perQueryMs);
		if (remaining < floor) {
			this.truncated = true;
			return null;
		}
		// A single slow query must never overrun the total budget.
		return Math.min(this.perQueryMs, remaining);
	}
}

/**
 * Resolve a parsed address to coordinates, walking the match tiers until one
 * succeeds.
 *
 * `result` is `null` when every tier failed *or* when the budget ran out
 * before a match was found; `searchTruncated` distinguishes the two. Callers
 * should use the grid fallback in both cases, but must label a truncated
 * search as provisional.
 */
export async function geocodeAddress(
	address: ParsedAddress,
	options: GeocodeOptions = {}
): Promise<GeocodeOutcome> {
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const totalBudgetMs = options.totalBudgetMs ?? TOTAL_BUDGET_MS;
	const fetchImpl = options.fetchImpl ?? fetch;
	const useCache = options.useCache ?? true;
	const key = addressCacheKey(address);

	if (useCache) {
		const cached = await readCache(key);
		if (cached) return { result: cached, searchTruncated: false };
	}

	const budget = new Budget(totalBudgetMs, timeoutMs);
	const result = await geocodeUncached(address, budget, fetchImpl);

	// Only a completed search may be cached. A truncated one never explored the
	// full ladder, so persisting it would freeze a provisional answer in place
	// and deny a later, unhurried retry the chance to do better.
	if (result && useCache && !budget.truncated) await writeCache(key, result);

	return { result, searchTruncated: budget.truncated };
}

async function geocodeUncached(
	address: ParsedAddress,
	budget: Budget,
	fetchImpl: typeof fetch
): Promise<GeocodeResult | null> {
	const vias = viaCandidates(address);
	const crosses = crossCandidates(address.cross);

	// --- Tiers 1 & 2: the exact cross-street on a candidate road. ---
	for (const via of vias) {
		for (const cross of crosses) {
			// Stop rather than risk overrunning the API Gateway ceiling. Nothing
			// has matched yet, so there is no partial result to preserve.
			const queryTimeout = budget.next();
			if (queryTimeout === null) return null;

			// Rule 4: `LIKE 'x %'` rather than `= 'x'`, so trailing whitespace in
			// the stored value cannot cause a false miss.
			const where = `PDONVIAL=${sqlQuote(via)} AND PDOTEXTO LIKE ${sqlQuote(`${cross} %`)}`;
			const plates = await queryPlates(where, 400, queryTimeout, fetchImpl);
			if (plates.length === 0) continue;

			const exact = plates.find((plate) => plate.number === address.number);
			if (exact) {
				return {
					lat: exact.lat,
					lng: exact.lng,
					matchTier: 'exact',
					resolvedPlate: `${exact.via} ${exact.text}`,
					cached: false
				};
			}

			const numbered = plates.filter((plate) => plate.number !== null);
			if (numbered.length > 0) {
				const nearest = numbered.reduce((best, plate) =>
					Math.abs((plate.number as number) - address.number) <
					Math.abs((best.number as number) - address.number)
						? plate
						: best
				);
				return {
					lat: nearest.lat,
					lng: nearest.lng,
					matchTier: 'nearest_number',
					resolvedPlate: `${nearest.via} ${nearest.text}`,
					cached: false
				};
			}
		}
	}

	// --- Tiers 3 & 4: pull the whole road once, then bracket the cross-street. ---
	const wantedCross = crossNumber(address.cross);
	for (const via of vias) {
		const queryTimeout = budget.next();
		if (queryTimeout === null) return null;

		const plates = await queryPlates(
			`PDONVIAL=${sqlQuote(via)}`,
			MAX_RECORDS,
			queryTimeout,
			fetchImpl
		);
		if (plates.length === 0) continue;

		// Rule 5: cross-street numbering has gaps (AC 26 has 41 and 43, no 42).
		// Snap to the numerically closest cross-street rather than collapsing to
		// a centroid of the entire road.
		if (wantedCross !== null) {
			// Distance from the requested cross-street, per plate.
			const scored: Array<{ plate: Plate; delta: number }> = [];
			for (const plate of plates) {
				const value = crossNumber(plate.cross);
				if (value === null) continue;
				scored.push({ plate, delta: Math.abs(value - wantedCross) });
			}

			if (scored.length > 0) {
				const bestDelta = Math.min(...scored.map((entry) => entry.delta));
				// A requested cross-street can sit exactly between two that exist
				// (42 between 41 and 43). Break that tie on the house number rather
				// than on the order the service happened to return rows in, so the
				// result is deterministic.
				const tied = scored.filter((entry) => entry.delta === bestDelta).map((e) => e.plate);
				const numbered = tied.filter((plate) => plate.number !== null);
				const pool = numbered.length > 0 ? numbered : tied;
				const nearest = pool.reduce((best, plate) =>
					Math.abs((plate.number ?? 0) - address.number) <
					Math.abs((best.number ?? 0) - address.number)
						? plate
						: best
				);
				return {
					lat: nearest.lat,
					lng: nearest.lng,
					matchTier: 'nearest_cross',
					resolvedPlate: `${nearest.via} ${nearest.text}`,
					cached: false
				};
			}
		}

		// Last resort: the road's centroid. Low confidence by construction —
		// a long arterial can span kilometres.
		const middle = centroid(plates);
		return {
			lat: middle.lat,
			lng: middle.lng,
			matchTier: 'street_segment',
			resolvedPlate: via,
			cached: false
		};
	}

	return null;
}

async function readCache(key: string): Promise<GeocodeResult | null> {
	try {
		const row = await prisma.geocodeCache.findUnique({ where: { addressKey: key } });
		if (!row) return null;
		return {
			lat: row.lat.toNumber(),
			lng: row.lng.toNumber(),
			matchTier: row.matchTier as MatchTier,
			resolvedPlate: row.resolvedPlate,
			cached: true
		};
	} catch (error) {
		// A cache failure must never break an estimate.
		console.error('Geocode cache read failed:', error);
		return null;
	}
}

async function writeCache(key: string, result: GeocodeResult): Promise<void> {
	try {
		const data = {
			lat: result.lat,
			lng: result.lng,
			matchTier: result.matchTier,
			resolvedPlate: result.resolvedPlate
		};
		const existing = await prisma.geocodeCache.findUnique({ where: { addressKey: key } });
		if (existing) {
			await prisma.geocodeCache.update({ where: { addressKey: key }, data });
		} else {
			await prisma.geocodeCache.create({ data: { addressKey: key, ...data } });
		}
	} catch (error) {
		console.error('Geocode cache write failed:', error);
	}
}
