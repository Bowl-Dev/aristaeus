/**
 * Geocoder unit tests. All HTTP is mocked; the one test that touches the live
 * cadastral service is isolated in `geocode.integration.test.ts`.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db.js', () => ({
	default: {
		geocodeCache: {
			findUnique: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({}),
			update: vi.fn().mockResolvedValue({})
		}
	}
}));

import { parseAddress } from '../address.js';
import { geocodeAddress, viaCandidates, crossCandidates, parsePlateText } from '../geocode.js';

/** Build a mock `fetch` that replies with the given features per `where` clause. */
function mockService(routes: Array<{ match: RegExp; features: unknown[] }>) {
	const calls: string[] = [];
	const fetchImpl = vi.fn(async (url: string | URL) => {
		// URLSearchParams encodes spaces as '+', so undo that before matching.
		const href = decodeURIComponent(String(url).replace(/\+/g, ' '));
		calls.push(href);
		const route = routes.find((candidate) => candidate.match.test(href));
		return {
			ok: true,
			json: async () => ({ features: route ? route.features : [] })
		} as Response;
	});
	return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

const plate = (via: string, text: string, x: number, y: number) => ({
	attributes: { PDONVIAL: via, PDOTEXTO: text },
	geometry: { x, y }
});

describe('viaCandidates', () => {
	// Rule 1: CL 26 has zero plates; Calle 26 is filed only as AC 26.
	it('offers the avenue alternate for calles and carreras', () => {
		expect(viaCandidates(parseAddress('Calle 26 # 42-90')!)).toEqual(['CL 26', 'AC 26']);
		expect(viaCandidates(parseAddress('Carrera 7 # 40b-95')!)).toEqual(['KR 7', 'AK 7']);
		expect(viaCandidates(parseAddress('AC 26 # 42-90')!)).toEqual(['AC 26', 'CL 26']);
		expect(viaCandidates(parseAddress('AK 19 # 153-10')!)).toEqual(['AK 19', 'KR 19']);
	});

	it('offers no alternate for diagonals and transversals', () => {
		expect(viaCandidates(parseAddress('Diagonal 163a # 20-11')!)).toEqual(['DG 163A']);
		expect(viaCandidates(parseAddress('Transversal 26b # 25-10')!)).toEqual(['TV 26B']);
	});
});

describe('crossCandidates', () => {
	// Rule 2: the cadastre normally drops BIS from the cross-street.
	it('tries the written form, then BIS removed, then BIS spaced', () => {
		expect(crossCandidates('14BIS')).toEqual(['14BIS', '14', '14 BIS']);
	});

	it('leaves plain cross-streets alone', () => {
		expect(crossCandidates('18A')).toEqual(['18A']);
	});
});

describe('parsePlateText', () => {
	// Rule 4: values carry trailing whitespace.
	it('trims surrounding whitespace', () => {
		expect(parsePlateText('  48A 92  ')).toEqual({ cross: '48A', number: 92 });
	});

	// Rule 3: numbers are zero-padded to two digits.
	it('reads zero-padded numbers as integers', () => {
		expect(parsePlateText('59A 08')).toEqual({ cross: '59A', number: 8 });
		expect(parsePlateText('65 01')).toEqual({ cross: '65', number: 1 });
	});

	it('handles the rare spaced-BIS cross-street', () => {
		expect(parsePlateText('86 BIS 99')).toEqual({ cross: '86 BIS', number: 99 });
	});

	// Rule 6: non-numeric cross-street tokens must not crash.
	it('handles non-numeric and number-less tokens without throwing', () => {
		expect(parsePlateText('MJ 12')).toEqual({ cross: 'MJ', number: 12 });
		expect(parsePlateText('MJ')).toEqual({ cross: 'MJ', number: null });
		expect(parsePlateText('')).toEqual({ cross: null, number: null });
	});
});

describe('geocodeAddress', () => {
	const options = { useCache: false as const };

	it('returns an exact match when the plate number is present', async () => {
		const { fetchImpl } = mockService([
			{
				match: /PDONVIAL='CL 125' AND PDOTEXTO LIKE '18A %'/,
				features: [plate('CL 125', '18A 05', -74.047218, 4.70405)]
			}
		]);

		const { result } = await geocodeAddress(parseAddress('Calle 125 # 18A-05')!, {
			...options,
			fetchImpl
		});

		expect(result).toMatchObject({
			matchTier: 'exact',
			resolvedPlate: 'CL 125 18A 05',
			lat: 4.70405,
			lng: -74.047218
		});
	});

	// Rule 3: house numbers are stored zero-padded ('18A 05'), so an unpadded
	// input must still match. The query asks for the whole cross-street and the
	// number is compared numerically.
	it('matches an unpadded house number against a zero-padded plate', async () => {
		const { fetchImpl, calls } = mockService([
			{ match: /18A/, features: [plate('CL 125', '18A 05', -74.047218, 4.70405)] }
		]);
		const { result } = await geocodeAddress(parseAddress('Calle 125 # 18A-5')!, {
			...options,
			fetchImpl
		});
		expect(calls[0]).toContain("PDOTEXTO LIKE '18A %'");
		expect(result).toMatchObject({ matchTier: 'exact', resolvedPlate: 'CL 125 18A 05' });
	});

	// Rule 4: trailing whitespace in stored values must not cause a miss.
	it('trims trailing whitespace from returned values', async () => {
		const { fetchImpl } = mockService([
			{ match: /KR 7/, features: [plate('KR 7 ', '59A 08 ', -74.06, 4.65)] }
		]);
		const { result } = await geocodeAddress(parseAddress('Carrera 7 # 59A-08')!, {
			...options,
			fetchImpl
		});
		expect(result).toMatchObject({ matchTier: 'exact', resolvedPlate: 'KR 7 59A 08' });
	});

	// Rule 1: falls through CL -> AC.
	it('retries under the avenue prefix when the calle form has no plates', async () => {
		const { fetchImpl, calls } = mockService([
			{
				match: /PDONVIAL='AC 26' AND PDOTEXTO LIKE '43 %'/,
				features: [plate('AC 26', '43 89', -74.0911, 4.6357)]
			}
		]);

		const { result } = await geocodeAddress(parseAddress('Calle 26 # 43-89')!, {
			...options,
			fetchImpl
		});

		expect(calls[0]).toContain("PDONVIAL='CL 26'");
		expect(result).toMatchObject({ matchTier: 'exact', resolvedPlate: 'AC 26 43 89' });
	});

	// Rule 2: Calle 153 # 14bis-81 is filed as AC 153 / '14 81'.
	it('finds a bis cross-street after dropping BIS and switching to the avenue form', async () => {
		const { fetchImpl } = mockService([
			{
				match: /PDONVIAL='AC 153' AND PDOTEXTO LIKE '14 %'/,
				features: [plate('AC 153', '14 81', -74.038615, 4.734171)]
			}
		]);

		const { result } = await geocodeAddress(parseAddress('Calle 153 # 14bis-81')!, {
			...options,
			fetchImpl
		});

		expect(result).toMatchObject({
			matchTier: 'exact',
			resolvedPlate: 'AC 153 14 81',
			lat: 4.734171
		});
	});

	it('falls back to the closest house number on the same cross-street', async () => {
		const { fetchImpl } = mockService([
			{
				match: /PDOTEXTO LIKE '19 %'/,
				features: [
					plate('CL 122', '19 59', -74.05, 4.706),
					plate('CL 122', '19 90', -74.052, 4.7065)
				]
			}
		]);

		const { result } = await geocodeAddress(parseAddress('Calle 122 # 19-45')!, {
			...options,
			fetchImpl
		});

		expect(result).toMatchObject({ matchTier: 'nearest_number', resolvedPlate: 'CL 122 19 59' });
	});

	// Rule 5: AC 26 has cross-streets 41 and 43 but no 42.
	it('snaps to the closest cross-street when the requested one does not exist', async () => {
		const { fetchImpl } = mockService([
			{
				match: /PDOTEXTO LIKE/,
				features: []
			},
			{
				match: /PDONVIAL='AC 26'/,
				features: [
					plate('AC 26', '41 20', -74.0894, 4.6339),
					plate('AC 26', '43 89', -74.0911, 4.6357),
					plate('AC 26', '100 04', -74.13, 4.67)
				]
			}
		]);

		const { result } = await geocodeAddress(parseAddress('Calle 26 # 42-90')!, {
			...options,
			fetchImpl
		});

		expect(result?.matchTier).toBe('nearest_cross');
		// 43 is as close as 41, and 43-89 is the closer house number to 90.
		expect(result?.resolvedPlate).toBe('AC 26 43 89');
	});

	it('falls back to the street centroid when no cross-street is usable', async () => {
		const { fetchImpl } = mockService([
			{ match: /PDOTEXTO LIKE/, features: [] },
			{
				match: /PDONVIAL='CL 153'/,
				features: [plate('CL 153', 'MJ', -74.02, 4.72), plate('CL 153', 'MJ', -74.04, 4.74)]
			}
		]);

		const { result } = await geocodeAddress(parseAddress('Calle 153 # 99-99')!, {
			...options,
			fetchImpl
		});

		expect(result).toMatchObject({ matchTier: 'street_segment', resolvedPlate: 'CL 153' });
		expect(result?.lat).toBeCloseTo(4.73, 5);
		expect(result?.lng).toBeCloseTo(-74.03, 5);
	});

	it('returns null when nothing matches at any tier', async () => {
		const { fetchImpl } = mockService([]);
		const { result } = await geocodeAddress(parseAddress('Calle 999 # 99-99')!, {
			...options,
			fetchImpl
		});
		expect(result).toBeNull();
	});

	it('treats an HTTP error as no match rather than throwing', async () => {
		const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response);
		const { result } = await geocodeAddress(parseAddress('Calle 125 # 18A-05')!, {
			...options,
			fetchImpl: fetchImpl as unknown as typeof fetch
		});
		expect(result).toBeNull();
	});

	it('treats a service error payload as no match', async () => {
		const fetchImpl = vi.fn(
			async () => ({ ok: true, json: async () => ({ error: { code: 400 } }) }) as Response
		);
		const { result } = await geocodeAddress(parseAddress('Calle 125 # 18A-05')!, {
			...options,
			fetchImpl: fetchImpl as unknown as typeof fetch
		});
		expect(result).toBeNull();
	});

	// The service has no SLA; a hang must never take a Lambda with it.
	it('gives up on timeout instead of hanging', async () => {
		const fetchImpl = vi.fn(
			(_url: string | URL, init?: { signal?: AbortSignal }) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
				})
		);
		const { result } = await geocodeAddress(parseAddress('Calle 125 # 18A-05')!, {
			...options,
			timeoutMs: 10,
			fetchImpl: fetchImpl as unknown as typeof fetch
		});
		expect(result).toBeNull();
	});

	it('reports a completed search as not truncated', async () => {
		const { fetchImpl } = mockService([
			{ match: /18A/, features: [plate('CL 125', '18A 05', -74.047218, 4.70405)] }
		]);
		const outcome = await geocodeAddress(parseAddress('Calle 125 # 18A-05')!, {
			...options,
			fetchImpl
		});
		expect(outcome.searchTruncated).toBe(false);
	});

	it('reports an exhaustive search that found nothing as not truncated', async () => {
		const { fetchImpl } = mockService([]);
		const outcome = await geocodeAddress(parseAddress('Calle 999 # 99-99')!, {
			...options,
			fetchImpl
		});
		// Nothing matched, but the whole ladder was explored — the address really
		// is absent, and a retry will not help.
		expect(outcome).toEqual({ result: null, searchTruncated: false });
	});

	describe('total wall-clock budget', () => {
		/** A service that always answers with no features, after `delayMs`. */
		function slowService(delayMs: number) {
			const calls: string[] = [];
			const fetchImpl = vi.fn(async (url: string | URL, init?: { signal?: AbortSignal }) => {
				calls.push(String(url));
				return new Promise<Response>((resolve, reject) => {
					const timer = setTimeout(
						() => resolve({ ok: true, json: async () => ({ features: [] }) } as Response),
						delayMs
					);
					init?.signal?.addEventListener('abort', () => {
						clearTimeout(timer);
						reject(new Error('aborted'));
					});
				});
			});
			return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
		}

		// The ladder issues up to 8 sequential queries. Without a total budget,
		// 8 x the per-query timeout would blow through API Gateway's hard 29 s
		// integration ceiling.
		it('stops descending the ladder once the budget is spent', async () => {
			const { fetchImpl, calls } = slowService(80);

			const outcome = await geocodeAddress(parseAddress('Calle 153 # 14bis-81')!, {
				useCache: false,
				fetchImpl,
				timeoutMs: 100,
				totalBudgetMs: 250
			});

			expect(outcome.result).toBeNull();
			expect(outcome.searchTruncated).toBe(true);
			// 'Calle 153 # 14bis-81' would otherwise issue 6 tier-1/2 queries
			// (2 vias x 3 BIS variants) plus 2 whole-road queries.
			expect(calls.length).toBeGreaterThan(0);
			expect(calls.length).toBeLessThan(8);
		});

		it('honours the budget as a wall-clock bound, not a per-query one', async () => {
			const { fetchImpl } = slowService(60);
			const startedAt = Date.now();

			await geocodeAddress(parseAddress('Calle 153 # 14bis-81')!, {
				useCache: false,
				fetchImpl,
				timeoutMs: 100,
				totalBudgetMs: 250
			});

			// Budget plus at most one in-flight query, with slack for CI jitter.
			expect(Date.now() - startedAt).toBeLessThan(1000);
		});

		it('does not start a query that cannot meaningfully complete', async () => {
			const { fetchImpl, calls } = slowService(10);

			const outcome = await geocodeAddress(parseAddress('Calle 125 # 18A-05')!, {
				useCache: false,
				fetchImpl,
				timeoutMs: 1000,
				// Below MIN_QUERY_BUDGET_MS, so not even the first query is worth it.
				totalBudgetMs: 1
			});

			expect(calls).toHaveLength(0);
			expect(outcome).toEqual({ result: null, searchTruncated: true });
		});

		it('clamps a per-query timeout to the remaining budget', async () => {
			// The query would take 5 s; the budget allows 900 ms in total. The
			// query must be aborted by the budget rather than by its own timeout.
			const { fetchImpl } = slowService(5000);
			const startedAt = Date.now();

			const outcome = await geocodeAddress(parseAddress('Calle 125 # 18A-05')!, {
				useCache: false,
				fetchImpl,
				timeoutMs: 5000,
				totalBudgetMs: 900
			});

			expect(Date.now() - startedAt).toBeLessThan(2000);
			expect(outcome.result).toBeNull();
		});

		it('never caches a truncated search', async () => {
			const cacheModule = await import('../../db.js');
			const create = (
				cacheModule.default as unknown as { geocodeCache: { create: ReturnType<typeof vi.fn> } }
			).geocodeCache.create;
			create.mockClear();

			const { fetchImpl } = slowService(80);
			const outcome = await geocodeAddress(parseAddress('Calle 153 # 14bis-81')!, {
				fetchImpl,
				timeoutMs: 100,
				totalBudgetMs: 250
			});

			expect(outcome.searchTruncated).toBe(true);
			// A provisional answer must not be frozen into the cache, or an
			// unhurried retry could never improve on it.
			expect(create).not.toHaveBeenCalled();
		});

		it('still caches a search that completed within budget', async () => {
			const cacheModule = await import('../../db.js');
			const create = (
				cacheModule.default as unknown as { geocodeCache: { create: ReturnType<typeof vi.fn> } }
			).geocodeCache.create;
			create.mockClear();

			const { fetchImpl } = mockService([
				{ match: /18A/, features: [plate('CL 125', '18A 05', -74.047218, 4.70405)] }
			]);
			const outcome = await geocodeAddress(parseAddress('Calle 125 # 18A-05')!, {
				fetchImpl,
				timeoutMs: 1000,
				totalBudgetMs: 5000
			});

			expect(outcome.searchTruncated).toBe(false);
			expect(create).toHaveBeenCalledTimes(1);
		});
	});

	it('escapes single quotes so a malicious address cannot break the where clause', async () => {
		const { fetchImpl, calls } = mockService([]);
		const address = parseAddress('Calle 125 # 18A-05')!;
		await geocodeAddress({ ...address, cross: "18A' OR '1'='1" }, { ...options, fetchImpl });
		expect(calls[0]).toContain("18A'' OR ''1''=''1");
	});
});
