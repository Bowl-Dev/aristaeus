/**
 * One-time migration of the retired localStorage calibration store.
 *
 * Corrections used to be kept in `aristaeus.delivery.calibration.v1`, which
 * trapped every operator's feedback in one browser. They now live in Postgres
 * behind `/api/delivery/observations`. This module exists purely so the rows an
 * operator already recorded are uploaded rather than silently lost: it reads the
 * legacy key once, POSTs each row, and only then clears the key.
 *
 * Nothing here writes to localStorage. Once every browser has run the migration
 * this file can be deleted.
 */

import { createDeliveryObservation } from '$lib/api/client';

const STORAGE_KEY = 'aristaeus.delivery.calibration.v1';

/** A correction as the old localStorage format stored it. */
export interface LegacyCorrection {
	/** Calle token, e.g. `146`, `145a`, `25bis`. */
	calle: string;
	/** Carrera token, e.g. `21`, `18a`. */
	carrera: string;
	/** Metre offset from the carrera (the `-86` in `# 21-86`). */
	numero: number;
	/** What the courier actually charged, in COP. */
	actualCost: number;
	recordedAt?: string;
}

export interface MigrationResult {
	/** Rows found in localStorage and considered worth uploading. */
	found: number;
	/** Rows the API accepted. */
	uploaded: number;
	/** Rows the API rejected — reported, not discarded silently. */
	failed: number;
	/** True when the legacy key was removed (only after a clean run). */
	cleared: boolean;
}

function isBrowser(): boolean {
	return typeof localStorage !== 'undefined';
}

/**
 * Render a legacy row the way the server's address parser expects to read it.
 * The old store only ever held calle/carrera/numero triples.
 */
export function legacyAddressText(row: LegacyCorrection): string {
	return `Calle ${row.calle} # ${row.carrera}-${row.numero}`;
}

/**
 * Accept only well-formed rows. Anything malformed is dropped rather than
 * thrown on, so one bad row cannot block the rest of the migration.
 */
function sanitize(rows: unknown): LegacyCorrection[] {
	if (!Array.isArray(rows)) return [];

	return rows.flatMap((row): LegacyCorrection[] => {
		if (typeof row !== 'object' || row === null) return [];
		const candidate = row as Partial<LegacyCorrection>;
		const calle = String(candidate.calle ?? '').trim();
		const carrera = String(candidate.carrera ?? '').trim();
		const numero = Number(candidate.numero);
		const actualCost = Number(candidate.actualCost);

		if (!calle || !carrera) return [];
		if (!Number.isFinite(numero) || numero < 0) return [];
		if (!Number.isFinite(actualCost) || actualCost <= 0) return [];

		return [
			{
				calle,
				carrera,
				numero,
				actualCost: Math.round(actualCost),
				recordedAt: candidate.recordedAt
			}
		];
	});
}

/** Corrections still sitting in the retired localStorage store, if any. */
export function readLegacyCorrections(): LegacyCorrection[] {
	if (!isBrowser()) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as { corrections?: unknown };
		return sanitize(parsed?.corrections);
	} catch {
		// Corrupt storage holds nothing recoverable; there is no data to lose.
		return [];
	}
}

/** True when this browser still has corrections that have not been uploaded. */
export function hasLegacyCorrections(): boolean {
	return readLegacyCorrections().length > 0;
}

/**
 * Upload every legacy correction to the API, then clear the legacy key.
 *
 * The key is only removed when every row was accepted — a partial failure keeps
 * the data on disk so the operator can retry rather than lose it. Uploads run
 * one at a time because the server geocodes each address as it writes it.
 */
export async function migrateLegacyCorrections(): Promise<MigrationResult> {
	const rows = readLegacyCorrections();
	if (!rows.length) return { found: 0, uploaded: 0, failed: 0, cleared: false };

	let uploaded = 0;
	let failed = 0;

	for (const row of rows) {
		try {
			await createDeliveryObservation({
				address: legacyAddressText(row),
				actualCost: row.actualCost,
				source: 'correction'
			});
			uploaded++;
		} catch {
			failed++;
		}
	}

	const cleared = failed === 0;
	if (cleared && isBrowser()) localStorage.removeItem(STORAGE_KEY);

	return { found: rows.length, uploaded, failed, cleared };
}
