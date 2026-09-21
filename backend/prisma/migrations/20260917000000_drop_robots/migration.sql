-- Drop the robot subsystem. No ESP32 ever connected: the robots table holds
-- only the seeded mock device, and orders.assigned_robot_id is always NULL.

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_assigned_robot_id_fkey";
ALTER TABLE "robots" DROP CONSTRAINT IF EXISTS "robots_current_order_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "orders_assigned_robot_id_idx";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN IF EXISTS "assigned_robot_id";

-- DropTable
DROP TABLE IF EXISTS "robots";
