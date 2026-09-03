/**
 * Bogota address parsing for the delivery cost engine.
 *
 * Turns free text an operator types (`Calle 125 # 18A-05 Apto 302`) into the
 * structured form the cadastral geocoder needs: a street prefix, a street
 * token, a cross-street token and a house number.
 *
 * ## Nomenclature notes confirmed against the live cadastral layer
 *
 * The Bogota cadastre (`placadomiciliaria`, 1.77M address plates) stores two
 * relevant fields:
 *
 * - `PDONVIAL` — the primary street, e.g. `CL 125`, `AC 26`, `KR 14BIS`.
 * - `PDOTEXTO` — `<cross-street> <house-number>`, e.g. `18A 05`.
 *
 * The forms below are what the data actually contains. They are the reason
 * this parser normalises the way it does:
 *
 * 1. `BIS` is **glued** in `PDONVIAL` (`CL 25BIS`, `KR 14BIS`) — there is no
 *    space and no `+0.5` numeric encoding. So we normalise street tokens by
 *    removing internal whitespace and upper-casing: `25 bis` -> `25BIS`.
 * 2. Letter suffixes are likewise glued: `DG 163A`, `KR 7B`, `CL 126A`.
 * 3. House numbers are **zero-padded to two digits** (`18A 05`, `65 01`), so
 *    the number is kept as an integer here and padded at query time.
 * 4. Prefix vocabulary is `CL`, `KR`, `AC` (Avenida Calle), `AK` (Avenida
 *    Carrera), `DG` (Diagonal), `TV` (Transversal).
 *
 * Anything trailing the house number (`Apto 302`, `Torre 3`, a neighbourhood
 * name) is ignored — it never participates in the plate lookup.
 */

/** A parsed Bogota address, in the cadastre's own vocabulary. */
export interface ParsedAddress {
	/** Normalised street prefix: `CL`, `KR`, `AC`, `AK`, `DG` or `TV`. */
	prefix: StreetPrefix;
	/** Street token with whitespace removed and upper-cased, e.g. `125`, `25BIS`, `145A`. */
	street: string;
	/** Cross-street token, same normalisation, e.g. `18A`, `14BIS`. */
	cross: string;
	/** House number as an integer. Zero-padding is applied at query time. */
	number: number;
	/** The original text, untouched, for display and audit. */
	raw: string;
}

export type StreetPrefix = 'CL' | 'KR' | 'AC' | 'AK' | 'DG' | 'TV';

/**
 * Spoken/written prefix forms mapped to the cadastre's abbreviation.
 *
 * Ordered longest-first when built into the regex, so `avenida carrera` wins
 * over `avenida` and `carrera` rather than being shadowed by them.
 */
const PREFIX_FORMS: ReadonlyArray<readonly [string, StreetPrefix]> = [
	['AVENIDA CARRERA', 'AK'],
	['AVENIDA CALLE', 'AC'],
	['AV CARRERA', 'AK'],
	['AV CALLE', 'AC'],
	['TRANSVERSAL', 'TV'],
	['DIAGONAL', 'DG'],
	['CARRERA', 'KR'],
	['CALLE', 'CL'],
	['CRA', 'KR'],
	['KRA', 'KR'],
	['DIAG', 'DG'],
	['TRANSV', 'TV'],
	['TRV', 'TV'],
	['AK', 'AK'],
	['AC', 'AC'],
	['CL', 'CL'],
	['KR', 'KR'],
	['DG', 'DG'],
	['TV', 'TV'],
	['CR', 'KR'],
	['CS', 'CL'],
	['KS', 'KR']
];

/**
 * A street or cross-street token: a number, optionally carrying a `BIS`
 * marker and/or a single letter suffix, in either order and with any spacing.
 * Matches `125`, `25 BIS`, `145A`, `14BIS`, `87 A`.
 */
const TOKEN = '\\d{1,3}(?:\\s*BIS)?(?:\\s*[A-Z])?(?:\\s*BIS)?';

/** Separator between the street and the cross-street: `#`, `No.`, `Nro`, `N°`. */
const SEPARATOR = '(?:#|N\\s*[O°]\\s*\\.?|NRO\\s*\\.?|NUMERO)?';

const PREFIX_ALTERNATION = PREFIX_FORMS.map(([form]) => form.replace(/ /g, '\\s+')).join('|');

const ADDRESS_RE = new RegExp(
	`^\\s*(${PREFIX_ALTERNATION})\\s*(${TOKEN})\\s*${SEPARATOR}\\s*(${TOKEN})\\s*[-\\s]\\s*(\\d{1,3})(?!\\d)`
);

/** Strip accents, upper-case, and collapse runs of whitespace and dashes. */
export function normalizeText(input: string): string {
	return String(input ?? '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toUpperCase()
		.replace(/[\u2010-\u2015]/g, '-')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Normalise a street/cross token the way the cadastre writes it: no internal
 * whitespace, upper-case. `25 bis` -> `25BIS`, `145 a` -> `145A`.
 */
export function normalizeToken(token: string): string {
	return normalizeText(token).replace(/\s+/g, '');
}

/**
 * Parse free-text into a {@link ParsedAddress}, or `null` when the text does
 * not contain a recognisable Bogota address.
 */
export function parseAddress(input: string): ParsedAddress | null {
	const raw = String(input ?? '').trim();
	if (!raw) return null;

	const match = ADDRESS_RE.exec(normalizeText(raw));
	if (!match) return null;

	const [, prefixForm, streetToken, crossToken, numberToken] = match;

	const canonical = PREFIX_FORMS.find(
		([form]) => form === normalizeText(prefixForm).replace(/\s+/g, ' ')
	);
	if (!canonical) return null;

	const number = Number(numberToken);
	if (!Number.isFinite(number) || number < 0) return null;

	return {
		prefix: canonical[1],
		street: normalizeToken(streetToken),
		cross: normalizeToken(crossToken),
		number,
		raw
	};
}

/**
 * Stable key for the geocode cache. Derived only from the parsed components,
 * so `calle 125 #18a-5` and `CL 125 # 18A-05 Apto 302` share one cache row.
 */
export function addressCacheKey(address: ParsedAddress): string {
	return `${address.prefix} ${address.street}|${address.cross}|${address.number}`;
}

/** Format a parsed address the way it is written in Colombia. */
export function formatAddress(address: ParsedAddress): string {
	const word: Record<StreetPrefix, string> = {
		CL: 'Calle',
		KR: 'Carrera',
		AC: 'Avenida Calle',
		AK: 'Avenida Carrera',
		DG: 'Diagonal',
		TV: 'Transversal'
	};
	return `${word[address.prefix]} ${address.street} # ${address.cross}-${String(
		address.number
	).padStart(2, '0')}`;
}
