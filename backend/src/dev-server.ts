/**
 * Local Development Server
 * Express server that wraps Lambda handlers for local development
 */

import { existsSync, readFileSync } from 'node:fs';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	APIGatewayProxyHandler,
	Context
} from 'aws-lambda';

// Import handlers
import { getIngredients } from './handlers/ingredients.js';
import { getOrder, listOrders, adminUpdateOrderStatus } from './handlers/orders.js';
import { quoteCheckout, createCheckout, getCheckout } from './handlers/checkout.js';
import { listCoupons, createCoupon, updateCoupon, deleteCoupon } from './handlers/coupons.js';
import { checkPhone, deleteUser } from './handlers/users.js';
import { getMenus } from './handlers/menus.js';
import { getConfig } from './handlers/config.js';
import {
	estimateDeliveryCost,
	listDeliveryObservations,
	createDeliveryObservation,
	deleteDeliveryObservation
} from './handlers/delivery.js';

// Load backend/.env (copied from .env.local / .env.hosted by the dev:* scripts).
// Prisma only reads DATABASE_URL from it; the handlers also need
// ADMIN_TOKEN, which they read per request, so loading after the imports is fine.
if (existsSync('.env')) {
	for (const line of readFileSync('.env', 'utf8').split('\n')) {
		const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
		if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
	}
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Convert an Express request into the slice of an API Gateway event the handlers
 * actually read: body, path parameters and query string. The rest of the shape
 * (requestContext, identity, multi-value maps) is cast rather than filled with
 * nulls — nothing reads it, and a wrong null is not better than an absent one.
 */
function createApiGatewayEvent(
	req: Request,
	pathParams?: Record<string, string>
): APIGatewayProxyEvent {
	return {
		body: req.body ? JSON.stringify(req.body) : null,
		headers: req.headers as Record<string, string>,
		httpMethod: req.method,
		path: req.path,
		pathParameters: pathParams ?? null,
		queryStringParameters: (req.query as Record<string, string>) ?? null
	} as unknown as APIGatewayProxyEvent;
}

/**
 * Wrap Lambda handler for Express
 */
function wrapHandler(handler: APIGatewayProxyHandler, pathParamNames?: string[]) {
	return async (req: Request, res: Response) => {
		try {
			// Extract path parameters
			const pathParams: Record<string, string> = {};
			if (pathParamNames) {
				for (const name of pathParamNames) {
					if (req.params[name]) {
						pathParams[name] = String(req.params[name]);
					}
				}
			}

			const event = createApiGatewayEvent(
				req,
				Object.keys(pathParams).length > 0 ? pathParams : undefined
			);
			// No handler reads the Lambda context.
			const result = (await handler(event, {} as Context, () => {})) as APIGatewayProxyResult;

			// Set headers
			if (result.headers) {
				for (const [key, value] of Object.entries(result.headers)) {
					if (value !== undefined) {
						res.setHeader(key, value.toString());
					}
				}
			}

			// Send response
			res.status(result.statusCode);
			if (result.body) {
				res.json(JSON.parse(result.body));
			} else {
				res.end();
			}
		} catch (error) {
			console.error('Handler error:', error);
			res.status(500).json({ error: 'Internal server error' });
		}
	};
}

// ============================================
// User-Facing APIs
// ============================================

// GET /api/ingredients
app.get('/api/ingredients', wrapHandler(getIngredients));

// GET /api/menus
app.get('/api/menus', wrapHandler(getMenus));

// GET /api/config
app.get('/api/config', wrapHandler(getConfig));

// GET /api/users/check-phone (returning customer check)
app.get('/api/users/check-phone', wrapHandler(checkPhone));

// DELETE /api/users (delete user data - Law 1581 compliance)
app.delete('/api/users', wrapHandler(deleteUser));

// GET /api/orders (list all - admin)
app.get('/api/orders', wrapHandler(listOrders));

// GET /api/orders/:id
app.get('/api/orders/:id', wrapHandler(getOrder, ['id']));

// PUT /api/orders/:orderId/status (admin update)
app.put('/api/orders/:orderId/status', wrapHandler(adminUpdateOrderStatus, ['orderId']));

// ============================================
// Checkout
// ============================================

app.post('/api/checkout/quote', wrapHandler(quoteCheckout));
app.post('/api/checkout', wrapHandler(createCheckout));
app.get('/api/checkout/:id', wrapHandler(getCheckout, ['id']));

// ============================================
// Coupons (admin, x-admin-token)
// ============================================

app.get('/api/coupons', wrapHandler(listCoupons));
app.post('/api/coupons', wrapHandler(createCoupon));
app.patch('/api/coupons/:id', wrapHandler(updateCoupon, ['id']));
app.delete('/api/coupons/:id', wrapHandler(deleteCoupon, ['id']));

// ============================================
// Delivery Cost Estimation (admin/ops)
// ============================================

// POST /api/delivery/estimate
app.post('/api/delivery/estimate', wrapHandler(estimateDeliveryCost));

// GET /api/delivery/observations
app.get('/api/delivery/observations', wrapHandler(listDeliveryObservations));

// POST /api/delivery/observations
app.post('/api/delivery/observations', wrapHandler(createDeliveryObservation));

// DELETE /api/delivery/observations/:id
app.delete('/api/delivery/observations/:id', wrapHandler(deleteDeliveryObservation, ['id']));

// Health check
app.get('/health', (_req, res) => {
	res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
	console.log(`🚀 Dev server running at http://localhost:${PORT}`);
	console.log('');
	console.log('Available endpoints:');
	console.log('  GET  /api/ingredients');
	console.log('  GET  /api/menus');
	console.log('  GET  /api/config');
	console.log('  GET  /api/users/check-phone       (returning customer check)');
	console.log('  DELETE /api/users                 (delete user data)');
	console.log('  GET  /api/orders                  (list all - admin)');
	console.log('  GET  /api/orders/:id');
	console.log('  PUT  /api/orders/:orderId/status  (admin update)');
	console.log('  POST /api/checkout/quote');
	console.log('  POST /api/checkout');
	console.log('  GET  /api/checkout/:id');
	console.log('  GET  /api/coupons                 (admin, x-admin-token)');
	console.log('  POST /api/coupons                 (admin, x-admin-token)');
	console.log('  PATCH /api/coupons/:id            (admin, x-admin-token)');
	console.log('  DELETE /api/coupons/:id           (admin, x-admin-token)');
	console.log('  POST /api/delivery/estimate       (ops)');
	console.log('  GET  /api/delivery/observations   (ops)');
	console.log('  POST /api/delivery/observations   (ops)');
	console.log('  DELETE /api/delivery/observations/:id (ops)');
	console.log('  GET  /health');
	console.log('');
});
