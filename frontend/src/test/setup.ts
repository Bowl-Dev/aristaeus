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
import { init, register, waitLocale } from 'svelte-i18n';
import en from '../lib/i18n/en.json';
import es from '../lib/i18n/es.json';
register('es', () => Promise.resolve(es));
register('en', () => Promise.resolve(en));
init({ fallbackLocale: 'es', initialLocale: 'es' });
await waitLocale();
