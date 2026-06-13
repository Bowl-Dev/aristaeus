-- CreateTable
CREATE TABLE "store_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "orders_paused" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_config_pkey" PRIMARY KEY ("id")
);

-- Insert singleton config row
INSERT INTO "store_config" ("id", "orders_paused", "updated_at")
VALUES (1, false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
