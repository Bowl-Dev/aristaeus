-- CreateTable
CREATE TABLE "pickup_points" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "location" VARCHAR(200) NOT NULL,
    "hours" VARCHAR(100) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_points_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "checkouts" ADD COLUMN     "pickup_point_id" INTEGER,
ADD COLUMN     "pickup_date" DATE;

-- CreateIndex
CREATE INDEX "checkouts_pickup_point_id_idx" ON "checkouts"("pickup_point_id");

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_pickup_point_id_fkey" FOREIGN KEY ("pickup_point_id") REFERENCES "pickup_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the first campus point
INSERT INTO "pickup_points" ("name", "location", "hours", "active", "display_order", "updated_at")
VALUES ('UNAL', 'Facultad de Medicina', 'Lunes a viernes, 11am – 2pm', true, 1, CURRENT_TIMESTAMP);
