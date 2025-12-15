/**
 * Robot API Handlers
 * POST /api/robots/register - Register a new robot
 * GET /api/robots/{robotId}/next-order - Get next order for robot
 * POST /api/robots/{robotId}/heartbeat - Robot heartbeat
 */

import type { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { success, created, badRequest, notFound, serverError, conflict } from '../lib/response.js';

// Validation schemas
const registerRobotSchema = z.object({
  name: z.string().min(1).max(100),
  identifier: z.string().min(1).max(100),
});

const heartbeatSchema = z.object({
  status: z.enum(['online', 'offline', 'busy', 'error']),
});

/**
 * POST /api/robots/register
 * Register a new robot
 */
export const registerRobot: APIGatewayProxyHandler = async (event) => {
  try {
    if (!event.body) {
      return badRequest('Request body is required');
    }

    const body = JSON.parse(event.body);
    const parseResult = registerRobotSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequest('Validation failed', parseResult.error.flatten());
    }

    const { name, identifier } = parseResult.data;

    // Check if robot already exists
    const existingRobot = await prisma.robot.findUnique({
      where: { identifier },
    });

    if (existingRobot) {
      // Update existing robot to online
      const updatedRobot = await prisma.robot.update({
        where: { identifier },
        data: {
          name,
          status: 'online',
          lastHeartbeat: new Date(),
        },
      });

      return success({
        robotId: updatedRobot.id,
        status: updatedRobot.status,
        message: 'Robot reconnected',
      });
    }

    // Create new robot
    const robot = await prisma.robot.create({
      data: {
        name,
        identifier,
        status: 'online',
        lastHeartbeat: new Date(),
      },
    });

    return created({
      robotId: robot.id,
      status: robot.status,
    });
  } catch (error) {
    console.error('Error registering robot:', error);
    return serverError('Failed to register robot');
  }
};

/**
 * GET /api/robots/{robotId}/next-order
 * Robot polls for next assigned order
 */
export const getNextOrder: APIGatewayProxyHandler = async (event) => {
  try {
    const robotId = parseInt(event.pathParameters?.robotId ?? '');

    if (isNaN(robotId)) {
      return badRequest('Invalid robot ID');
    }

    // Verify robot exists
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
    });

    if (!robot) {
      return notFound(`Robot ${robotId} not found`);
    }

    // Find order assigned to this robot that's queued or assigned
    const order = await prisma.order.findFirst({
      where: {
        assignedRobotId: robotId,
        status: { in: ['queued', 'assigned'] },
      },
      include: {
        items: {
          include: {
            ingredient: {
              select: { id: true, name: true },
            },
          },
          orderBy: { sequenceOrder: 'asc' },
        },
      },
    });

    if (!order) {
      return success({ orderId: null });
    }

    // Update order status to 'assigned' if it was 'queued'
    if (order.status === 'queued') {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'assigned' },
      });
    }

    return success({
      orderId: order.id,
      bowlSize: order.bowlSize,
      items: order.items.map((item) => ({
        ingredientId: item.ingredient.id,
        ingredientName: item.ingredient.name,
        quantityGrams: item.quantityGrams.toNumber(),
        sequenceOrder: item.sequenceOrder,
      })),
    });
  } catch (error) {
    console.error('Error fetching next order:', error);
    return serverError('Failed to fetch next order');
  }
};

/**
 * POST /api/robots/{robotId}/heartbeat
 * Robot sends periodic heartbeat
 */
export const heartbeat: APIGatewayProxyHandler = async (event) => {
  try {
    const robotId = parseInt(event.pathParameters?.robotId ?? '');

    if (isNaN(robotId)) {
      return badRequest('Invalid robot ID');
    }

    if (!event.body) {
      return badRequest('Request body is required');
    }

    const body = JSON.parse(event.body);
    const parseResult = heartbeatSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequest('Validation failed', parseResult.error.flatten());
    }

    const { status } = parseResult.data;

    // Verify robot exists
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
    });

    if (!robot) {
      return notFound(`Robot ${robotId} not found`);
    }

    // Don't allow setting to 'online' if robot has current order
    if (status === 'online' && robot.currentOrderId) {
      return conflict('Robot has active order, cannot set status to online');
    }

    // Update robot heartbeat
    await prisma.robot.update({
      where: { id: robotId },
      data: {
        status,
        lastHeartbeat: new Date(),
      },
    });

    // If robot is now online and has no order, try to assign pending orders
    if (status === 'online' && !robot.currentOrderId) {
      await tryAssignPendingOrder(robotId);
    }

    return success({ success: true });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    return serverError('Failed to process heartbeat');
  }
};

/**
 * Try to assign a pending order to a robot
 */
async function tryAssignPendingOrder(robotId: number) {
  try {
    // Find oldest pending order
    const pendingOrder = await prisma.order.findFirst({
      where: {
        status: 'pending',
        assignedRobotId: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!pendingOrder) {
      return;
    }

    // Assign order to robot
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: pendingOrder.id },
        data: {
          status: 'queued',
          assignedRobotId: robotId,
          assignedAt: new Date(),
        },
      });

      await tx.robot.update({
        where: { id: robotId },
        data: {
          currentOrderId: pendingOrder.id,
          status: 'busy',
        },
      });
    });

    console.log(`Assigned order ${pendingOrder.id} to robot ${robotId}`);
  } catch (error) {
    console.error('Error assigning pending order:', error);
  }
}
