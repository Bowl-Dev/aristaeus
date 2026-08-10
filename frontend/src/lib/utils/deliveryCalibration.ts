/**
 * Storage for the delivery-model calibration set.
 *
 * Every time an operator tells us what a courier really charged, the price is
 * appended here and the model is re-fitted against the seed history plus these
 * corrections. Corrections live in localStorage (this is a PoC, and there is no
 * corrections table yet), with JSON export/import so a calibration set can be
 * moved between machines or handed back to Ops to fold into the seed data.
 */

import {
	SEED_OBSERVATIONS,
	fitDeliveryModel,
	isValidAddress,
	type BogotaAddress,
	type DeliveryModel,
	type DeliveryObservation
} from './deliveryModel';

const STORAGE_KEY = 'aristaeus.delivery.calibration.v1';
const EXPORT_VERSION = 1;

/** Shape of the exported / stored JSON file. */
export interface CalibrationFile {
	version: number;
	exportedAt: string;
	corrections: DeliveryObservation[];
}

function isBrowser(): boolean {
	return typeof localStorage !== 'undefined';
}

/**
 * Accept only well-formed corrections. Anything malformed is dropped rather
 * than thrown on, so one bad row cannot brick the applet on load.
 */
function sanitize(rows: unknown): DeliveryObservation[] {
	if (!Array.isArray(rows)) return [];

	return rows.flatMap((row): DeliveryObservation[] => {
		if (typeof row !== 'object' || row === null) return [];
		const candidate = row as Partial<DeliveryObservation>;
		const address = {
			calle: String(candidate.calle ?? ''),
			carrera: String(candidate.carrera ?? ''),
			numero: Number(candidate.numero)
		};
		if (!isValidAddress(address)) return [];
		if (!Number.isFinite(candidate.actualCost) || (candidate.actualCost as number) <= 0) return [];

		return [
			{
				...address,
				actualCost: Math.round(candidate.actualCost as number),
				recordedAt: candidate.recordedAt ?? new Date().toISOString(),
				source: 'correction'
			}
		];
	});
}

/** Corrections recorded so far, newest last. Empty on the server or on first run. */
export function loadCorrections(): DeliveryObservation[] {
	if (!isBrowser()) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as Partial<CalibrationFile>;
		return sanitize(parsed?.corrections);
	} catch {
		// Corrupt storage is not worth surfacing: fall back to the seed-only model.
		return [];
	}
}

function persist(corrections: DeliveryObservation[]): void {
	if (!isBrowser()) return;
	const file: CalibrationFile = {
		version: EXPORT_VERSION,
		exportedAt: new Date().toISOString(),
		corrections
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
}

/** Record a real courier price and return the updated correction set. */
export function addCorrection(address: BogotaAddress, actualCost: number): DeliveryObservation[] {
	const correction: DeliveryObservation = {
		...address,
		actualCost: Math.round(actualCost),
		recordedAt: new Date().toISOString(),
		source: 'correction'
	};
	const corrections = [...loadCorrections(), correction];
	persist(corrections);
	return corrections;
}

/** Drop one correction by its position, and return what is left. */
export function removeCorrection(index: number): DeliveryObservation[] {
	const corrections = loadCorrections().filter((_, i) => i !== index);
	persist(corrections);
	return corrections;
}

/** Forget every correction, reverting the model to the Ops seed fit. */
export function clearCorrections(): DeliveryObservation[] {
	if (isBrowser()) localStorage.removeItem(STORAGE_KEY);
	return [];
}

/** The full training set: Ops history plus operator corrections. */
export function calibrationSet(corrections: DeliveryObservation[]): DeliveryObservation[] {
	return [...SEED_OBSERVATIONS, ...corrections];
}

/** The model currently in effect, given the corrections recorded so far. */
export function currentModel(corrections: DeliveryObservation[]): DeliveryModel {
	return fitDeliveryModel(calibrationSet(corrections));
}

/** Serialise the corrections for download. */
export function exportCorrections(corrections: DeliveryObservation[]): string {
	const file: CalibrationFile = {
		version: EXPORT_VERSION,
		exportedAt: new Date().toISOString(),
		corrections
	};
	return JSON.stringify(file, null, 2);
}

/**
 * Merge an exported file into the stored corrections, skipping rows already
 * present so re-importing the same file is harmless. Returns the merged set and
 * how many rows were actually added.
 */
export function importCorrections(json: string): {
	corrections: DeliveryObservation[];
	added: number;
} {
	const parsed = JSON.parse(json) as Partial<CalibrationFile>;
	const incoming = sanitize(parsed?.corrections);
	const existing = loadCorrections();

	const key = (row: DeliveryObservation) =>
		`${row.calle}|${row.carrera}|${row.numero}|${row.actualCost}|${row.recordedAt}`;
	const seen = new Set(existing.map(key));
	const fresh = incoming.filter((row) => !seen.has(key(row)));

	const merged = [...existing, ...fresh];
	persist(merged);
	return { corrections: merged, added: fresh.length };
}
