-- CreateTable: Users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "street_address" VARCHAR(200) NOT NULL,
    "neighborhood" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique phone for users
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- Migrate existing orders: Create placeholder users for any existing orders
-- This creates a user for each unique customer_name in existing orders
INSERT INTO "users" ("id", "name", "phone", "street_address", "neighborhood", "city", "department", "updated_at")
SELECT
    gen_random_uuid(),
    COALESCE(customer_name, 'Unknown Customer'),
    'placeholder_' || id::text,
    'Unknown Address',
    'Unknown',
    'Unknown',
    'Unknown',
    CURRENT_TIMESTAMP
FROM "orders"
WHERE customer_name IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add user_id column to orders (nullable first for migration)
ALTER TABLE "orders" ADD COLUMN "user_id" UUID;

-- Link existing orders to their placeholder users
UPDATE "orders" o
SET "user_id" = u."id"
FROM "users" u
WHERE u."phone" = 'placeholder_' || o."id"::text;

-- For any remaining orders without users, delete them (test data)
DELETE FROM "order_items" WHERE "order_id" IN (SELECT "id" FROM "orders" WHERE "user_id" IS NULL);
DELETE FROM "orders" WHERE "user_id" IS NULL;

-- Now make user_id required
ALTER TABLE "orders" ALTER COLUMN "user_id" SET NOT NULL;

-- Drop the old customer_name column
ALTER TABLE "orders" DROP COLUMN "customer_name";

-- CreateIndex: orders.user_id
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- AddForeignKey: orders.user_id -> users.id
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
