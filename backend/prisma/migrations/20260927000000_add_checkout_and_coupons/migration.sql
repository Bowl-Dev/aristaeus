-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "checkout_id" UUID;

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "campaign_name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(20) NOT NULL,
    "value" DECIMAL(10,2),
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "budget_total" DECIMAL(12,2) NOT NULL,
    "budget_remaining" DECIMAL(12,2) NOT NULL,
    "min_bowls" INTEGER NOT NULL DEFAULT 1,
    "first_purchase_only" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkouts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_number" SERIAL NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "delivery_fee" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "service_fee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "coupon_id" INTEGER,
    "payment_status" VARCHAR(30) NOT NULL DEFAULT 'awaiting_payment',
    "wompi_tx_id" VARCHAR(64),
    "payment_method" VARCHAR(30),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_active_idx" ON "coupons"("active");

-- CreateIndex
CREATE UNIQUE INDEX "checkouts_order_number_key" ON "checkouts"("order_number");

-- CreateIndex
CREATE INDEX "checkouts_user_id_idx" ON "checkouts"("user_id");

-- CreateIndex
CREATE INDEX "checkouts_coupon_id_payment_status_idx" ON "checkouts"("coupon_id", "payment_status");

-- CreateIndex
CREATE INDEX "orders_checkout_id_idx" ON "orders"("checkout_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "checkouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Order numbers are shown as AG-####; start at 1000 so they are always four digits
ALTER SEQUENCE "checkouts_order_number_seq" RESTART WITH 1000;
