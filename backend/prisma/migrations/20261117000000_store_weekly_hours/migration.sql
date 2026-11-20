-- ENG-117: editable weekly store hours. NULL falls back to DEFAULT_WEEKLY_HOURS in code.
ALTER TABLE "store_config" ADD COLUMN "weekly_hours" JSONB;
