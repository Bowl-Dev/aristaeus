/**
 * User Handler Unit Tests
 * Tests for checkPhone (returning-customer lookup) and deleteUser (Law 1581).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock the Prisma client before importing handlers
vi.mock('../../lib/db.js', () => ({
	default: {
		user: {
			findUnique: vi.fn(),
			delete: vi.fn()
		}
	}
}));

import prisma from '../../lib/db.js';
import { checkPhone, deleteUser } from '../users.js';

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
	return {
		body: null,
		headers: {},
		multiValueHeaders: {},
		httpMethod: 'GET',
		isBase64Encoded: false,
		path: '/api/users/check-phone',
		pathParameters: null,
		queryStringParameters: null,
		multiValueQueryStringParameters: null,
		stageVariables: null,
		requestContext: {} as APIGatewayProxyEvent['requestContext'],
		resource: '',
		...overrides
	};
}

const mockContext: Context = {
	callbackWaitsForEmptyEventLoop: false,
	functionName: 'test',
	functionVersion: '1',
	invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
	memoryLimitInMB: '128',
	awsRequestId: 'test-request-id',
	logGroupName: 'test-log-group',
	logStreamName: 'test-log-stream',
	getRemainingTimeInMillis: () => 5000,
	done: () => {},
	fail: () => {},
	succeed: () => {}
};

describe('User Handlers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('checkPhone', () => {
		it('should return 400 when phone is missing', async () => {
			const event = createMockEvent({ queryStringParameters: null });

			const response = await checkPhone(event, mockContext, () => {});

			expect(response!.statusCode).toBe(400);
			expect(JSON.parse(response!.body).message).toContain('Phone number is required');
		});

		it('should return 400 for invalid phone format', async () => {
			const event = createMockEvent({ queryStringParameters: { phone: '123' } });

			const response = await checkPhone(event, mockContext, () => {});

			expect(response!.statusCode).toBe(400);
		});

		it('should return exists:false when user not found', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

			const event = createMockEvent({ queryStringParameters: { phone: '3001234567' } });

			const response = await checkPhone(event, mockContext, () => {});

			expect(response!.statusCode).toBe(200);
			expect(JSON.parse(response!.body).exists).toBe(false);
		});

		it('should return the most-recent address from the address relation', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue({
				name: 'Juan Pérez',
				email: 'juan@example.com',
				addresses: [
					{
						streetAddress: 'Calle 100 # 15-20',
						neighborhood: 'Chicó',
						city: 'Bogotá',
						department: 'Bogotá D.C.',
						postalCode: '110131'
					}
				]
			} as never);

			const event = createMockEvent({ queryStringParameters: { phone: '3001234567' } });

			const response = await checkPhone(event, mockContext, () => {});

			expect(response!.statusCode).toBe(200);
			const body = JSON.parse(response!.body);
			expect(body.exists).toBe(true);
			expect(body.user.name).toBe('Juan Pérez');
			expect(body.user.address).toEqual({
				streetAddress: 'Calle 100 # 15-20',
				neighborhood: 'Chicó',
				city: 'Bogotá',
				department: 'Bogotá D.C.',
				postalCode: '110131'
			});

			// Verify the query fetches the single most-recent address
			const selectArg = vi.mocked(prisma.user.findUnique).mock.calls[0][0] as {
				select: { addresses: unknown };
			};
			expect(selectArg.select.addresses).toEqual({
				orderBy: { createdAt: 'desc' },
				take: 1,
				select: {
					streetAddress: true,
					neighborhood: true,
					city: true,
					department: true,
					postalCode: true
				}
			});
		});

		it('should return address:null when the user has no addresses', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue({
				name: 'Juan Pérez',
				email: null,
				addresses: []
			} as never);

			const event = createMockEvent({ queryStringParameters: { phone: '3001234567' } });

			const response = await checkPhone(event, mockContext, () => {});

			expect(response!.statusCode).toBe(200);
			const body = JSON.parse(response!.body);
			expect(body.exists).toBe(true);
			expect(body.user.address).toBeNull();
		});
	});

	describe('deleteUser', () => {
		it('should return 400 when body is missing', async () => {
			const event = createMockEvent({ httpMethod: 'DELETE', body: null });

			const response = await deleteUser(event, mockContext, () => {});

			expect(response!.statusCode).toBe(400);
		});

		it('should return 404 when user not found', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

			const event = createMockEvent({
				httpMethod: 'DELETE',
				body: JSON.stringify({ phone: '3001234567' })
			});

			const response = await deleteUser(event, mockContext, () => {});

			expect(response!.statusCode).toBe(404);
		});

		it('should delete the user and report orders deleted', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue({
				id: 'test-uuid',
				orders: [{ id: 1 }, { id: 2 }]
			} as never);
			vi.mocked(prisma.user.delete).mockResolvedValue({} as never);

			const event = createMockEvent({
				httpMethod: 'DELETE',
				body: JSON.stringify({ phone: '3001234567' })
			});

			const response = await deleteUser(event, mockContext, () => {});

			expect(response!.statusCode).toBe(200);
			const body = JSON.parse(response!.body);
			expect(body.success).toBe(true);
			expect(body.ordersDeleted).toBe(2);
			expect(prisma.user.delete).toHaveBeenCalledWith({ where: { phone: '3001234567' } });
		});
	});
});
