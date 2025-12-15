/**
 * Prisma Database Client
 * Singleton pattern for Lambda function reuse
 */

import { PrismaClient } from '@prisma/client';

// Prevent multiple instances in development (hot reloading)
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
