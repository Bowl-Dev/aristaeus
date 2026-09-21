/**
 * Lambda Response Utilities
 * Standardized API Gateway response helpers
 */

import type { APIGatewayProxyResult } from 'aws-lambda';

// ponytail: seven near-identical builders around one object literal. Ceiling: each
// new status code copies the boilerplate again. Upgrade: collapse to json(status,
// body) when the next status code is needed.
const defaultHeaders = {
	'Content-Type': 'application/json',
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Credentials': 'false'
};

export function success<T>(data: T, statusCode = 200): APIGatewayProxyResult {
	return {
		statusCode,
		headers: defaultHeaders,
		body: JSON.stringify(data)
	};
}

export function created<T>(data: T): APIGatewayProxyResult {
	return success(data, 201);
}

export function badRequest(message: string, details?: unknown): APIGatewayProxyResult {
	return {
		statusCode: 400,
		headers: defaultHeaders,
		body: JSON.stringify({
			error: 'Bad Request',
			message,
			details
		})
	};
}

export function notFound(message: string): APIGatewayProxyResult {
	return {
		statusCode: 404,
		headers: defaultHeaders,
		body: JSON.stringify({
			error: 'Not Found',
			message
		})
	};
}

export function conflict(message: string): APIGatewayProxyResult {
	return {
		statusCode: 409,
		headers: defaultHeaders,
		body: JSON.stringify({
			error: 'Conflict',
			message
		})
	};
}

export function serverError(message = 'Internal server error'): APIGatewayProxyResult {
	return {
		statusCode: 500,
		headers: defaultHeaders,
		body: JSON.stringify({
			error: 'Internal Server Error',
			message
		})
	};
}

export function serviceUnavailable(message = 'Service unavailable'): APIGatewayProxyResult {
	return {
		statusCode: 503,
		headers: defaultHeaders,
		body: JSON.stringify({
			message
		})
	};
}
