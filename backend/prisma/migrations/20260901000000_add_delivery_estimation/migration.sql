-- CreateTable
CREATE TABLE "geocode_cache" (
    "id" SERIAL NOT NULL,
    "address_key" VARCHAR(200) NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "match_tier" VARCHAR(30) NOT NULL,
    "resolved_plate" VARCHAR(120),
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "geocode_cache_address_key_key" ON "geocode_cache"("address_key");

-- CreateTable
CREATE TABLE "delivery_observations" (
    "id" SERIAL NOT NULL,
    "raw_address" VARCHAR(255) NOT NULL,
    "prefix" VARCHAR(4) NOT NULL,
    "street" VARCHAR(20) NOT NULL,
    "cross" VARCHAR(20) NOT NULL,
    "number" INTEGER NOT NULL,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "match_tier" VARCHAR(30),
    "north_km" DECIMAL(8,4),
    "east_km" DECIMAL(8,4),
    "actual_cost" INTEGER NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'correction',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_observations_source_idx" ON "delivery_observations"("source");
