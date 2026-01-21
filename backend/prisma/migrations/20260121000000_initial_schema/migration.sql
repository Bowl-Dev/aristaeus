-- CreateTable
CREATE TABLE "ingredients" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "calories_per_100g" DECIMAL(6,2) NOT NULL,
    "protein_g_per_100g" DECIMAL(5,2) NOT NULL,
    "carbs_g_per_100g" DECIMAL(5,2) NOT NULL,
    "fat_g_per_100g" DECIMAL(5,2) NOT NULL,
    "fiber_g_per_100g" DECIMAL(5,2),
    "available" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "bowl_size" INTEGER NOT NULL,
    "customer_name" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "total_calories" DECIMAL(7,2),
    "total_protein_g" DECIMAL(6,2),
    "total_carbs_g" DECIMAL(6,2),
    "total_fat_g" DECIMAL(6,2),
    "total_fiber_g" DECIMAL(6,2),
    "total_weight_g" DECIMAL(7,2),
    "assigned_robot_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "quantity_grams" DECIMAL(7,2) NOT NULL,
    "sequence_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robots" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "identifier" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'offline',
    "current_order_id" INTEGER,
    "last_heartbeat" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_assigned_robot_id_idx" ON "orders"("assigned_robot_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "robots_identifier_key" ON "robots"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "robots_current_order_id_key" ON "robots"("current_order_id");

-- CreateIndex
CREATE INDEX "robots_status_idx" ON "robots"("status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_robot_id_fkey" FOREIGN KEY ("assigned_robot_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robots" ADD CONSTRAINT "robots_current_order_id_fkey" FOREIGN KEY ("current_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
