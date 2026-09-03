import { describe, it, expect } from 'vitest';
import {
	parseAddress,
	normalizeText,
	normalizeToken,
	addressCacheKey,
	formatAddress
} from '../address.js';

describe('normalizeText', () => {
	it('strips accents, upper-cases and collapses whitespace', () => {
		expect(normalizeText('  Diagonal   163a  ')).toBe('DIAGONAL 163A');
		expect(normalizeText('Bogotá')).toBe('BOGOTA');
	});

	it('normalises unicode dashes to ASCII hyphens', () => {
		expect(normalizeText('18A–05')).toBe('18A-05');
	});
});

describe('normalizeToken', () => {
	// Trap: BIS and letter suffixes are glued in the cadastre, never spaced.
	it('glues BIS and letter suffixes', () => {
		expect(normalizeToken('25 bis')).toBe('25BIS');
		expect(normalizeToken('145 a')).toBe('145A');
		expect(normalizeToken(' 18a ')).toBe('18A');
	});
});

describe('parseAddress', () => {
	it('parses the canonical form', () => {
		expect(parseAddress('Calle 125 # 18A-05')).toMatchObject({
			prefix: 'CL',
			street: '125',
			cross: '18A',
			number: 5
		});
	});

	it('is case- and whitespace-insensitive', () => {
		const a = parseAddress('calle 125 #18a-5');
		const b = parseAddress('CALLE   125   #   18A - 05');
		expect(a).toMatchObject({ prefix: 'CL', street: '125', cross: '18A', number: 5 });
		expect(b).toMatchObject({ prefix: 'CL', street: '125', cross: '18A', number: 5 });
	});

	it('accepts #, No., No and Nro separators', () => {
		for (const text of [
			'Calle 125 # 18A-05',
			'Calle 125 No. 18A-05',
			'Calle 125 No 18A-05',
			'Calle 125 Nro 18A-05',
			'Calle 125 18A-05'
		]) {
			expect(parseAddress(text), text).toMatchObject({ street: '125', cross: '18A', number: 5 });
		}
	});

	it('ignores apartment, tower and neighbourhood tails', () => {
		expect(parseAddress('Calle 104 # 18A-52 Apto 302')).toMatchObject({
			street: '104',
			cross: '18A',
			number: 52
		});
		expect(parseAddress('Calle 104 # 18A-52 Torre 3, Chico Norte, Bogota')).toMatchObject({
			street: '104',
			cross: '18A',
			number: 52
		});
	});

	// Trap 3: BIS is glued, not a +0.5 numeric hack.
	it('normalises BIS in both street and cross positions', () => {
		expect(parseAddress('Calle 25bis # 31a-38')).toMatchObject({
			street: '25BIS',
			cross: '31A',
			number: 38
		});
		expect(parseAddress('Calle 25 BIS No 31 A - 38')).toMatchObject({
			street: '25BIS',
			cross: '31A'
		});
		expect(parseAddress('Calle 153 # 14bis-81')).toMatchObject({
			street: '153',
			cross: '14BIS',
			number: 81
		});
	});

	// Trap 4: letter suffixes are glued.
	it('glues letter suffixes', () => {
		expect(parseAddress('Diagonal 163a # 20-11')).toMatchObject({
			prefix: 'DG',
			street: '163A'
		});
		expect(parseAddress('Calle 92 # 19b-22')).toMatchObject({ cross: '19B', number: 22 });
	});

	// Trap 5: the full prefix vocabulary.
	it('maps the whole prefix vocabulary', () => {
		const cases: Array<[string, string]> = [
			['Calle 26 # 42-90', 'CL'],
			['Cl 26 # 42-90', 'CL'],
			['Carrera 7 # 40b-95', 'KR'],
			['Cra 7 # 40b-95', 'KR'],
			['Kr 7 # 40b-95', 'KR'],
			['Avenida Calle 26 # 42-90', 'AC'],
			['Av Calle 26 # 42-90', 'AC'],
			['AC 26 # 42-90', 'AC'],
			['Avenida Carrera 19 # 153-10', 'AK'],
			['AK 19 # 153-10', 'AK'],
			['Diagonal 163a # 20-11', 'DG'],
			['Transversal 26b # 25-10', 'TV']
		];
		for (const [text, prefix] of cases) {
			expect(parseAddress(text)?.prefix, text).toBe(prefix);
		}
	});

	it('returns null for text that is not an address', () => {
		expect(parseAddress('Torre 3 Apto 501')).toBeNull();
		expect(parseAddress('hola mundo')).toBeNull();
		expect(parseAddress('')).toBeNull();
		expect(parseAddress('   ')).toBeNull();
	});

	it('preserves the raw input for display', () => {
		expect(parseAddress('  calle 125 #18a-5  ')?.raw).toBe('calle 125 #18a-5');
	});
});

describe('addressCacheKey', () => {
	it('collapses equivalent spellings onto one key', () => {
		const a = parseAddress('calle 125 #18a-5')!;
		const b = parseAddress('CALLE 125 No. 18A-05 Apto 302')!;
		expect(addressCacheKey(a)).toBe(addressCacheKey(b));
	});

	it('distinguishes different addresses', () => {
		const a = parseAddress('Calle 125 # 18A-05')!;
		const b = parseAddress('Calle 125 # 18A-06')!;
		expect(addressCacheKey(a)).not.toBe(addressCacheKey(b));
	});
});

describe('formatAddress', () => {
	it('writes the address the Colombian way, with a zero-padded number', () => {
		expect(formatAddress(parseAddress('calle 125 #18a-5')!)).toBe('Calle 125 # 18A-05');
		expect(formatAddress(parseAddress('AK 19 # 153-10')!)).toBe('Avenida Carrera 19 # 153-10');
	});
});
