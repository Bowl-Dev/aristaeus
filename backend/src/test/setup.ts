/**
 * Backend Test Setup
 * Configures the test environment for Vitest
 */

import { beforeEach } from 'vitest';
import { PrismockClient } from 'prismock';

// Reset prismock data between tests
beforeEach(() => {
	// Prismock automatically resets between tests when using a new instance
});

// Mock environment variables for tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

export { PrismockClient };
