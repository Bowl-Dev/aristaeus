-- Isolate Colombian addresses into their own table (one-to-many from users),
-- snapshot the delivered-to address onto each order, and persist per-order
-- delivery instructions.

-- CreateTable: Addresses
CREATE TABLE "addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "street_address" VARCHAR(200) NOT NULL,
    "neighborhood" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: addresses.user_id
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- AddForeignKey: addresses.user_id -> users.id (cascade delete)
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add address reference + delivery snapshot + instructions columns to orders
ALTER TABLE "orders" ADD COLUMN "address_id" UUID;
ALTER TABLE "orders" ADD COLUMN "delivery_street_address" VARCHAR(200);
ALTER TABLE "orders" ADD COLUMN "delivery_neighborhood" VARCHAR(100);
ALTER TABLE "orders" ADD COLUMN "delivery_city" VARCHAR(100);
ALTER TABLE "orders" ADD COLUMN "delivery_department" VARCHAR(100);
ALTER TABLE "orders" ADD COLUMN "delivery_postal_code" VARCHAR(6);
ALTER TABLE "orders" ADD COLUMN "delivery_instructions" VARCHAR(500);

-- Backfill: create one address row per existing user from their embedded columns
INSERT INTO "addresses" ("id", "user_id", "street_address", "neighborhood", "city", "department", "postal_code", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    u."id",
    u."street_address",
    u."neighborhood",
    u."city",
    u."department",
    u."postal_code",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users" u;

-- Backfill: link each order to its user's address and copy the snapshot
UPDATE "orders" o
SET
    "address_id" = a."id",
    "delivery_street_address" = a."street_address",
    "delivery_neighborhood" = a."neighborhood",
    "delivery_city" = a."city",
    "delivery_department" = a."department",
    "delivery_postal_code" = a."postal_code"
FROM "addresses" a
WHERE a."user_id" = o."user_id";

-- CreateIndex: orders.address_id
CREATE INDEX "orders_address_id_idx" ON "orders"("address_id");

-- AddForeignKey: orders.address_id -> addresses.id (set null on delete to preserve snapshot)
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_fkey"
    FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the now-migrated embedded address columns from users
ALTER TABLE "users" DROP COLUMN "street_address";
ALTER TABLE "users" DROP COLUMN "neighborhood";
ALTER TABLE "users" DROP COLUMN "city";
ALTER TABLE "users" DROP COLUMN "department";
ALTER TABLE "users" DROP COLUMN "postal_code";
