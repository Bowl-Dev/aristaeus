-- CreateTable
CREATE TABLE "menus" (
    "id" SERIAL NOT NULL,
    "name_es" VARCHAR(200) NOT NULL,
    "name_en" VARCHAR(200) NOT NULL,
    "description_es" TEXT NOT NULL,
    "description_en" TEXT NOT NULL,
    "bowl_size" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_ingredients" (
    "id" SERIAL NOT NULL,
    "menu_id" INTEGER NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "quantity_grams" DECIMAL(7,2) NOT NULL,
    "sequence_order" INTEGER NOT NULL,

    CONSTRAINT "menu_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "menu_ingredients_menu_id_idx" ON "menu_ingredients"("menu_id");

-- AddForeignKey
ALTER TABLE "menu_ingredients" ADD CONSTRAINT "menu_ingredients_menu_id_fkey"
  FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_ingredients" ADD CONSTRAINT "menu_ingredients_ingredient_id_fkey"
  FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
