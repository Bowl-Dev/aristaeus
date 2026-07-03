/**
 * Order Handler Unit Tests
 * Tests for order creation, validation, and user upsert logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock the Prisma client before importing handlers
vi.mock('../../lib/db.js', () => ({
	default: {
		ingredient: {
			findMany: vi.fn()
		},
		user: {
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn()
		},
		address: {
			findFirst: vi.fn(),
			create: vi.fn()
		},
		order: {
			create: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn(),
			count: vi.fn()
		},
		orderItem: {
			createMany: vi.fn()
		},
		robot: {
			findFirst: vi.fn(),
			update: vi.fn()
		},
		storeConfig: {
			findFirst: vi.fn()
		},
		$transaction: vi.fn()
	}
}));

import prisma from '../../lib/db.js';
import { createOrder } from '../orders.js';

// Helper to create mock API Gateway event
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
	return {
		body: null,
		headers: {},
		multiValueHeaders: {},
		httpMethod: 'POST',
		isBase64Encoded: false,
		path: '/api/orders',
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

// Sample test data
const validCustomer = {
	name: 'Juan Pérez',
	phone: '3001234567',
	email: 'juan@example.com',
	address: {
		streetAddress: 'Calle 100 # 15-20',
		neighborhood: 'Chicó',
		city: 'Bogotá',
		department: 'Bogotá D.C.',
		postalCode: '110131'
	}
};

const validOrderRequest = {
	bowlSize: 450,
	customer: validCustomer,
	items: [
		{ ingredientId: 1, quantityGrams: 100 },
		{ ingredientId: 2, quantityGrams: 50 }
	]
};

const mockIngredients = [
	{
		id: 1,
		name: 'Rice',
		category: 'base',
		caloriesPer100g: { toNumber: () => 130 },
		proteinGPer100g: { toNumber: () => 2.7 },
		carbsGPer100g: { toNumber: () => 28 },
		fatGPer100g: { toNumber: () => 0.3 },
		fiberGPer100g: { toNumber: () => 0.4 },
		pricePerG: { toNumber: () => 5 },
		available: true
	},
	{
		id: 2,
		name: 'Chicken',
		category: 'protein',
		caloriesPer100g: { toNumber: () => 165 },
		proteinGPer100g: { toNumber: () => 31 },
		carbsGPer100g: { toNumber: () => 0 },
		fatGPer100g: { toNumber: () => 3.6 },
		fiberGPer100g: { toNumber: () => 0 },
		pricePerG: { toNumber: () => 15 },
		available: true
	}
];

// Captured references for assertions on the most recent transaction mock
let lastTx: {
	user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
	address: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
	order: { create: ReturnType<typeof vi.fn> };
	orderItem: { createMany: ReturnType<typeof vi.fn> };
};

/**
 * Wire up a happy-path transaction mock. `existingUser` toggles whether the
 * user already exists (findUnique returns a user) or is created fresh.
 */
function mockSuccessfulTransaction(options: { existingUser?: boolean } = {}) {
	const user = {
		id: 'test-uuid',
		name: validCustomer.name,
		phone: validCustomer.phone,
		email: validCustomer.email
	};

	const createdAddress = {
		id: 'address-uuid',
		userId: user.id,
		streetAddress: validCustomer.address.streetAddress,
		neighborhood: validCustomer.address.neighborhood,
		city: validCustomer.address.city,
		department: validCustomer.address.department,
		postalCode: validCustomer.address.postalCode
	};

	vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
		const mockTx = {
			user: {
				findUnique: vi.fn().mockResolvedValue(options.existingUser ? user : null),
				create: vi.fn().mockResolvedValue(user),
				update: vi.fn().mockResolvedValue(user)
			},
			address: {
				findFirst: vi.fn().mockResolvedValue(null),
				create: vi.fn().mockResolvedValue(createdAddress)
			},
			order: {
				create: vi.fn().mockResolvedValue({
					id: 1,
					status: 'pending',
					createdAt: new Date()
				})
			},
			orderItem: {
				createMany: vi.fn().mockResolvedValue({ count: 2 })
			}
		};
		lastTx = mockTx as never;
		return (callback as (tx: unknown) => unknown)(mockTx);
	});
}

describe('Order Handlers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: store is not paused so order creation proceeds normally
		vi.mocked(prisma.storeConfig.findFirst).mockResolvedValue({ ordersPaused: false } as never);
	});

	describe('createOrder', () => {
		it('should return 400 when request body is missing', async () => {
			const event = createMockEvent({ body: null });

			const response = await createOrder(event, mockContext, () => {});

			expect(response).toBeDefined();
			expect(response!.statusCode).toBe(400);
			expect(JSON.parse(response!.body).message).toContain('Request body is required');
		});

		it('should return 400 for invalid bowl size', async () => {
			const event = createMockEvent({
				body: JSON.stringify({
					...validOrderRequest,
					bowlSize: 999 // Invalid size
				})
			});

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(400);
			expect(JSON.parse(response!.body).message).toContain('Validation failed');
		});

		it('should return 400 for invalid Colombian phone format', async () => {
			const event = createMockEvent({
				body: JSON.stringify({
					...validOrderRequest,
					customer: {
						...validCustomer,
						phone: '123' // Too short
					}
				})
			});

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(400);
			const body = JSON.parse(response!.body);
			expect(body.message).toContain('Validation failed');
		});

		it('should accept valid +57 phone format', async () => {
			const event = createMockEvent({
				body: JSON.stringify({
					...validOrderRequest,
					customer: {
						...validCustomer,
						phone: '+573001234567' // With country code
					}
				})
			});

			vi.mocked(prisma.ingredient.findMany).mockResolvedValue(mockIngredients as never);
			mockSuccessfulTransaction();
			vi.mocked(prisma.robot.findFirst).mockResolvedValue(null);

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(201);
		});

		it('should create an address and snapshot it plus delivery instructions onto the order', async () => {
			const event = createMockEvent({
				body: JSON.stringify({
					...validOrderRequest,
					deliveryInstructions: 'Ring the bell twice'
				})
			});

			vi.mocked(prisma.ingredient.findMany).mockResolvedValue(mockIngredients as never);
			mockSuccessfulTransaction();
			vi.mocked(prisma.robot.findFirst).mockResolvedValue(null);

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(201);

			// Address dedupe lookup then creation (no existing match)
			expect(lastTx.address.findFirst).toHaveBeenCalledWith({
				where: {
					userId: 'test-uuid',
					streetAddress: validCustomer.address.streetAddress,
					neighborhood: validCustomer.address.neighborhood,
					city: validCustomer.address.city,
					department: validCustomer.address.department,
					postalCode: validCustomer.address.postalCode
				}
			});
			expect(lastTx.address.create).toHaveBeenCalledOnce();

			// Order carries the addressId, snapshot fields, and delivery instructions
			expect(lastTx.order.create).toHaveBeenCalledOnce();
			const orderData = lastTx.order.create.mock.calls[0][0].data;
			expect(orderData.addressId).toBe('address-uuid');
			expect(orderData.deliveryStreetAddress).toBe(validCustomer.address.streetAddress);
			expect(orderData.deliveryNeighborhood).toBe(validCustomer.address.neighborhood);
			expect(orderData.deliveryCity).toBe(validCustomer.address.city);
			expect(orderData.deliveryDepartment).toBe(validCustomer.address.department);
			expect(orderData.deliveryPostalCode).toBe(validCustomer.address.postalCode);
			expect(orderData.deliveryInstructions).toBe('Ring the bell twice');
		});

		it('should reuse an existing address instead of creating a duplicate', async () => {
			const event = createMockEvent({
				body: JSON.stringify(validOrderRequest)
			});

			vi.mocked(prisma.ingredient.findMany).mockResolvedValue(mockIngredients as never);

			const existingAddress = {
				id: 'existing-address-uuid',
				userId: 'test-uuid',
				streetAddress: validCustomer.address.streetAddress,
				neighborhood: validCustomer.address.neighborhood,
				city: validCustomer.address.city,
				department: validCustomer.address.department,
				postalCode: validCustomer.address.postalCode
			};

			vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
				const mockTx = {
					user: {
						findUnique: vi
							.fn()
							.mockResolvedValue({ id: 'test-uuid', name: 'Juan', phone: validCustomer.phone }),
						create: vi.fn(),
						update: vi.fn()
					},
					address: {
						findFirst: vi.fn().mockResolvedValue(existingAddress),
						create: vi.fn()
					},
					order: {
						create: vi.fn().mockResolvedValue({ id: 1, status: 'pending', createdAt: new Date() })
					},
					orderItem: { createMany: vi.fn().mockResolvedValue({ count: 2 }) }
				};
				lastTx = mockTx as never;
				return (callback as (tx: unknown) => unknown)(mockTx);
			});
			vi.mocked(prisma.robot.findFirst).mockResolvedValue(null);

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(201);
			expect(lastTx.address.create).not.toHaveBeenCalled();
			expect(lastTx.order.create.mock.calls[0][0].data.addressId).toBe('existing-address-uuid');
		});

		it('should return 400 for incomplete address', async () => {
			const event = createMockEvent({
				body: JSON.stringify({
					...validOrderRequest,
					customer: {
						...validCustomer,
						address: {
							streetAddress: 'Calle 100 # 15-20',
							// Missing required fields
							neighborhood: '',
							city: '',
							department: ''
						}
					}
				})
			});

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(400);
		});

		it('should accept optional postal code', async () => {
			const event = createMockEvent({
				body: JSON.stringify({
					...validOrderRequest,
					customer: {
						...validCustomer,
						address: {
							...validCustomer.address,
							postalCode: undefined // Optional field
						}
					}
				})
			});

			vi.mocked(prisma.ingredient.findMany).mockResolvedValue(mockIngredients as never);
			mockSuccessfulTransaction();
			vi.mocked(prisma.robot.findFirst).mockResolvedValue(null);

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(201);
		});

		it('should return 400 for invalid postal code format', async () => {
			const event = createMockEvent({
				body: JSON.stringify({
					...validOrderRequest,
					customer: {
						...validCustomer,
						address: {
							...validCustomer.address,
							postalCode: '12345' // Only 5 digits, should be 6
						}
					}
				})
			});

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(400);
		});

		it('should return 400 when total weight exceeds bowl capacity', async () => {
			const event = createMockEvent({
				body: JSON.stringify({
					bowlSize: 250,
					customer: validCustomer,
					items: [
						{ ingredientId: 1, quantityGrams: 200 },
						{ ingredientId: 2, quantityGrams: 100 } // Total 300g > 250g capacity
					]
				})
			});

			vi.mocked(prisma.ingredient.findMany).mockResolvedValue(mockIngredients as never);

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(400);
			expect(JSON.parse(response!.body).message).toContain('exceeds bowl capacity');
		});

		it('should return 400 for unavailable ingredients', async () => {
			const event = createMockEvent({
				body: JSON.stringify(validOrderRequest)
			});

			// Only return one ingredient (simulate one not found)
			vi.mocked(prisma.ingredient.findMany).mockResolvedValue([mockIngredients[0]] as never);

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(400);
			expect(JSON.parse(response!.body).message).toContain('not found or unavailable');
		});

		it('should return 400 for empty items array', async () => {
			const event = createMockEvent({
				body: JSON.stringify({
					...validOrderRequest,
					items: []
				})
			});

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(400);
		});

		it('should return 503 when orders are paused', async () => {
			vi.mocked(prisma.storeConfig.findFirst).mockResolvedValue({
				ordersPaused: true
			} as never);

			const event = createMockEvent({
				body: JSON.stringify(validOrderRequest)
			});

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(503);
			expect(JSON.parse(response!.body).message).toBe('ordersPaused');
		});

		it('should continue order creation when store config read fails (fail open)', async () => {
			vi.mocked(prisma.storeConfig.findFirst).mockRejectedValue(new Error('db down'));

			vi.mocked(prisma.ingredient.findMany).mockResolvedValue(mockIngredients as never);
			mockSuccessfulTransaction();
			vi.mocked(prisma.robot.findFirst).mockResolvedValue(null);

			const event = createMockEvent({
				body: JSON.stringify(validOrderRequest)
			});

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(201);
		});
	});

	describe('Phone Validation', () => {
		const phoneTestCases = [
			{ phone: '3001234567', valid: true, desc: '10 digits without country code' },
			{ phone: '+573001234567', valid: true, desc: '10 digits with +57' },
			{ phone: '573001234567', valid: false, desc: '12 digits without +' },
			{ phone: '300123456', valid: false, desc: '9 digits (too short)' },
			{ phone: '30012345678', valid: false, desc: '11 digits (too long)' },
			{ phone: 'abcdefghij', valid: false, desc: 'letters instead of numbers' },
			{ phone: '+1234567890', valid: false, desc: 'wrong country code' }
		];

		phoneTestCases.forEach(({ phone, valid, desc }) => {
			it(`should ${valid ? 'accept' : 'reject'} ${desc}`, async () => {
				const event = createMockEvent({
					body: JSON.stringify({
						...validOrderRequest,
						customer: { ...validCustomer, phone }
					})
				});

				if (valid) {
					vi.mocked(prisma.ingredient.findMany).mockResolvedValue(mockIngredients as never);
					mockSuccessfulTransaction();
					vi.mocked(prisma.robot.findFirst).mockResolvedValue(null);
				}

				const response = await createOrder(event, mockContext, () => {});

				if (valid) {
					expect(response!.statusCode).toBe(201);
				} else {
					expect(response!.statusCode).toBe(400);
				}
			});
		});
	});

	describe('Address Validation', () => {
		it('should reject street address that is too short', async () => {
			const event = createMockEvent({
				body: JSON.stringify({
					...validOrderRequest,
					customer: {
						...validCustomer,
						address: {
							...validCustomer.address,
							streetAddress: 'ABC' // Less than 5 characters
						}
					}
				})
			});

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(400);
		});

		it('should reject neighborhood that is too short', async () => {
			const event = createMockEvent({
				body: JSON.stringify({
					...validOrderRequest,
					customer: {
						...validCustomer,
						address: {
							...validCustomer.address,
							neighborhood: 'A' // Less than 2 characters
						}
					}
				})
			});

			const response = await createOrder(event, mockContext, () => {});

			expect(response!.statusCode).toBe(400);
		});
	});
});
