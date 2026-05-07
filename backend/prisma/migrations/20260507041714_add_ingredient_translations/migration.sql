-- Add localized name columns to ingredients (nullable first so we can backfill)
ALTER TABLE "ingredients" ADD COLUMN "name_es" VARCHAR(100);
ALTER TABLE "ingredients" ADD COLUMN "name_en" VARCHAR(100);

-- Backfill English names from existing `name` column (current data is English-keyed)
UPDATE "ingredients" SET "name_en" = "name";

-- Backfill Spanish names from existing frontend i18n mapping
UPDATE "ingredients" SET "name_es" = 'Pollo'                       WHERE "name" = 'Chicken';
UPDATE "ingredients" SET "name_es" = 'Salmón'                      WHERE "name" = 'Salmon';
UPDATE "ingredients" SET "name_es" = 'Champiñón'                   WHERE "name" = 'Mushroom';
UPDATE "ingredients" SET "name_es" = 'Arroz'                       WHERE "name" = 'Rice';
UPDATE "ingredients" SET "name_es" = 'Quinoa'                      WHERE "name" = 'Quinoa';
UPDATE "ingredients" SET "name_es" = 'Tomates Cherry'              WHERE "name" = 'Cherry Tomatoes';
UPDATE "ingredients" SET "name_es" = 'Mango'                       WHERE "name" = 'Mango';
UPDATE "ingredients" SET "name_es" = 'Zanahoria'                   WHERE "name" = 'Carrot';
UPDATE "ingredients" SET "name_es" = 'Cebolla'                     WHERE "name" = 'Onion';
UPDATE "ingredients" SET "name_es" = 'Aguacate'                    WHERE "name" = 'Avocado';
UPDATE "ingredients" SET "name_es" = 'Maíz'                        WHERE "name" = 'Corn';
UPDATE "ingredients" SET "name_es" = 'Pepino'                      WHERE "name" = 'Cucumber';
UPDATE "ingredients" SET "name_es" = 'Mozzarella'                  WHERE "name" = 'Mozzarella';
UPDATE "ingredients" SET "name_es" = 'Cebollín'                    WHERE "name" = 'Green Onion';
UPDATE "ingredients" SET "name_es" = 'Maní'                        WHERE "name" = 'Peanuts';
UPDATE "ingredients" SET "name_es" = 'Teriyaki'                    WHERE "name" = 'Teriyaki';
UPDATE "ingredients" SET "name_es" = 'Aceite de Oliva Balsámico'   WHERE "name" = 'Olive Oil Balsamic';
UPDATE "ingredients" SET "name_es" = 'Miel Mostaza'                WHERE "name" = 'Honey Mustard';
UPDATE "ingredients" SET "name_es" = 'Cebolla Crujiente'           WHERE "name" = 'Crispy Onion';

-- For any rows that didn't match the seeded set (e.g. ad-hoc inserts pre-migration),
-- fall back to the English name so NOT NULL holds.
UPDATE "ingredients" SET "name_es" = "name" WHERE "name_es" IS NULL;

-- Now enforce NOT NULL
ALTER TABLE "ingredients" ALTER COLUMN "name_es" SET NOT NULL;
ALTER TABLE "ingredients" ALTER COLUMN "name_en" SET NOT NULL;
