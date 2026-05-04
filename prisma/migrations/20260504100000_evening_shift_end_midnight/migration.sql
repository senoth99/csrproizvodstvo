-- Вечерние бригады: конец смены в полночь (00:00), а не 02:00.
UPDATE "Shift" SET "endTime" = '00:00' WHERE "startTime" = '18:00' AND "endTime" = '02:00';
