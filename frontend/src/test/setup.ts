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
