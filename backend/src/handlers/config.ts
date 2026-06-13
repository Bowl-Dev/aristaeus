/**
 * Store Config API Handler
 * GET /api/config - Get store configuration (e.g. whether orders are paused)
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import prisma from '../lib/db.js';
import { success, serverError } from '../lib/response.js';

/**
 * GET /api/config
 * Returns the singleton store configuration. Defaults ordersPaused to false
 * when no config row exists.
 */
export const getConfig: APIGatewayProxyHandler = async () => {
	try {
		const config = await prisma.storeConfig.findFirst();

		return success({ ordersPaused: config?.ordersPaused ?? false });
	} catch (error) {
		console.error('Error fetching store config:', error);
		return serverError('Failed to fetch store config');
	}
};
