PRAGMA foreign_keys = ON;

ALTER TABLE alliance_ranks ADD COLUMN colour TEXT NOT NULL DEFAULT '#d7a83e';

UPDATE settings
SET value = '18', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
