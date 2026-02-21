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
import {
	createOrder,
	getOrder,
	listOrders,
	updateOrderStatus,
	adminUpdateOrderStatus
} from './handlers/orders.js';
import { registerRobot, getNextOrder, heartbeat } from './handlers/robots.js';
import { checkPhone } from './handlers/users.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Convert Express request to API Gateway event
 */
function createApiGatewayEvent(
	req: Request,
	pathParams?: Record<string, string>
): APIGatewayProxyEvent {
	return {
		body: req.body ? JSON.stringify(req.body) : null,
		headers: req.headers as Record<string, string>,
		multiValueHeaders: {},
		httpMethod: req.method,
		isBase64Encoded: false,
		path: req.path,
		pathParameters: pathParams || null,
		queryStringParameters: (req.query as Record<string, string>) || null,
		multiValueQueryStringParameters: null,
		stageVariables: null,
		requestContext: {
			accountId: 'local',
			apiId: 'local',
			authorizer: null,
			protocol: 'HTTP/1.1',
			httpMethod: req.method,
			identity: {
				accessKey: null,
				accountId: null,
				apiKey: null,
				apiKeyId: null,
				caller: null,
				clientCert: null,
				cognitoAuthenticationProvider: null,
				cognitoAuthenticationType: null,
				cognitoIdentityId: null,
				cognitoIdentityPoolId: null,
				principalOrgId: null,
				sourceIp: req.ip || '127.0.0.1',
				user: null,
				userAgent: req.get('user-agent') || null,
				userArn: null
			},
			path: req.path,
			stage: 'local',
			requestId: `local-${Date.now()}`,
			requestTimeEpoch: Date.now(),
			resourceId: 'local',
			resourcePath: req.path
		},
		resource: req.path
	};
}

/**
 * Create mock Lambda context
 */
function createContext(): Context {
	return {
		callbackWaitsForEmptyEventLoop: true,
		functionName: 'local-dev',
		functionVersion: '1',
		invokedFunctionArn: 'local',
		memoryLimitInMB: '256',
		awsRequestId: `local-${Date.now()}`,
		logGroupName: 'local',
		logStreamName: 'local',
		getRemainingTimeInMillis: () => 30000,
		done: () => {},
		fail: () => {},
		succeed: () => {}
	};
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
			const context = createContext();

			const result = (await handler(event, context, () => {})) as APIGatewayProxyResult;

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

// GET /api/users/check-phone (returning customer check)
app.get('/api/users/check-phone', wrapHandler(checkPhone));

// GET /api/orders (list all - admin)
app.get('/api/orders', wrapHandler(listOrders));

// POST /api/orders
app.post('/api/orders', wrapHandler(createOrder));

// GET /api/orders/:id
app.get('/api/orders/:id', wrapHandler(getOrder, ['id']));

// PUT /api/orders/:orderId/status (admin update)
app.put('/api/orders/:orderId/status', wrapHandler(adminUpdateOrderStatus, ['orderId']));

// ============================================
// Robot-Facing APIs
// ============================================

// POST /api/robots/register
app.post('/api/robots/register', wrapHandler(registerRobot));

// GET /api/robots/:robotId/next-order
app.get('/api/robots/:robotId/next-order', wrapHandler(getNextOrder, ['robotId']));

// POST /api/orders/:orderId/status
app.post('/api/orders/:orderId/status', wrapHandler(updateOrderStatus, ['orderId']));

// POST /api/robots/:robotId/heartbeat
app.post('/api/robots/:robotId/heartbeat', wrapHandler(heartbeat, ['robotId']));

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
	console.log('  GET  /api/users/check-phone       (returning customer check)');
	console.log('  GET  /api/orders                  (list all - admin)');
	console.log('  POST /api/orders');
	console.log('  GET  /api/orders/:id');
	console.log('  PUT  /api/orders/:orderId/status  (admin update)');
	console.log('  POST /api/orders/:orderId/status  (robot update)');
	console.log('  POST /api/robots/register');
	console.log('  GET  /api/robots/:robotId/next-order');
	console.log('  POST /api/robots/:robotId/heartbeat');
	console.log('  GET  /health');
	console.log('');
});
