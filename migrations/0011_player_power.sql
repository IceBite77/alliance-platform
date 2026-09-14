PRAGMA foreign_keys = ON;

ALTER TABLE players ADD COLUMN player_power INTEGER;

UPDATE settings
SET value = '11', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
