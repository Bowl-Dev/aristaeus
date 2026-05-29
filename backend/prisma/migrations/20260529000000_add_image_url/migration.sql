-- Add nullable image_url column to ingredients (S3-hosted product imagery)
ALTER TABLE "ingredients" ADD COLUMN "image_url" TEXT;

-- Add nullable image_url column to menus (S3-hosted product imagery)
ALTER TABLE "menus" ADD COLUMN "image_url" TEXT;
