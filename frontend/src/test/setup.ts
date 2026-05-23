/**
 * Frontend Test Setup
 * Configures the test environment for Vitest with Svelte Testing Library
 */

import '@testing-library/jest-dom/vitest';

// Mock SvelteKit modules
import { vi } from 'vitest';

// Mock $app/paths
vi.mock('$app/paths', () => ({
	base: '',
	assets: '',
	resolve: (path: string) => path
}));

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true,
	dev: true,
	building: false
}));

// Mock $app/navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	invalidate: vi.fn(),
	invalidateAll: vi.fn(),
	preloadData: vi.fn(),
	preloadCode: vi.fn()
}));

// Mock environment variables
vi.stubEnv('VITE_API_URL', 'http://localhost:3000');

// Initialize svelte-i18n so components that call $_() can render in tests.
import { init, register, waitLocale, locale } from 'svelte-i18n';
import en from '../lib/i18n/en.json';
import es from '../lib/i18n/es.json';
register('es', () => Promise.resolve(es));
register('en', () => Promise.resolve(en));
init({ fallbackLocale: 'es', initialLocale: 'es' });
await waitLocale();

// Mock $lib/i18n — its index.ts imports `$app/environment` at module load
// (for the `browser` flag), which the vite transformer resolves before our
// vi.mock above takes effect. Components that import `setLocale`/`locale`
// from `$lib/i18n` (e.g. AppHeader) need this shim.
vi.mock('$lib/i18n', () => ({
	locale,
	waitForLocale: () => waitLocale(),
	setLocale: (newLocale: string) => locale.set(newLocale)
}));
