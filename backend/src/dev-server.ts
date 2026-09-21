/**
 * Local Development Server
 * Express server that wraps Lambda handlers for local development
 */

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
import { createOrder, getOrder, listOrders, adminUpdateOrderStatus } from './handlers/orders.js';
import { checkPhone, deleteUser } from './handlers/users.js';
import { getMenus } from './handlers/menus.js';
import { getConfig } from './handlers/config.js';
import { listCoupons, createCoupon, validateCouponCode } from './handlers/coupons.js';
import {
	estimateDeliveryCost,
	listDeliveryObservations,
	createDeliveryObservation,
	deleteDeliveryObservation
} from './handlers/delivery.js';

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
						pathParams[name] = req.params[name];
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

// POST /api/orders
app.post('/api/orders', wrapHandler(createOrder));

// GET /api/orders/:id
app.get('/api/orders/:id', wrapHandler(getOrder, ['id']));

// PUT /api/orders/:orderId/status (admin update)
app.put('/api/orders/:orderId/status', wrapHandler(adminUpdateOrderStatus, ['orderId']));

// ============================================
// Coupons
// ============================================

// GET /api/coupons (list - admin)
app.get('/api/coupons', wrapHandler(listCoupons));

// POST /api/coupons (create - admin)
app.post('/api/coupons', wrapHandler(createCoupon));

// POST /api/coupons/validate (customer "Aplicar")
app.post('/api/coupons/validate', wrapHandler(validateCouponCode));

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
	console.log('  POST /api/orders');
	console.log('  GET  /api/orders/:id');
	console.log('  PUT  /api/orders/:orderId/status  (admin update)');
	console.log('  GET  /api/coupons                 (list - admin)');
	console.log('  POST /api/coupons                 (create - admin)');
	console.log('  POST /api/coupons/validate        (apply a code to a cart)');
	console.log('  GET  /health');
	console.log('');
});
