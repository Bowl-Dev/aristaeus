-- AL-55: UNAL pickup window moves from 11am – 2pm to 12pm – 2pm.
UPDATE "pickup_points"
SET "hours" = 'Lunes a viernes, 12pm – 2pm', "updated_at" = CURRENT_TIMESTAMP
WHERE "name" = 'UNAL' AND "hours" = 'Lunes a viernes, 11am – 2pm';
