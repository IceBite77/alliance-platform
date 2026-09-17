PRAGMA foreign_keys = ON;

ALTER TABLE player_roster_snapshots
ADD COLUMN source TEXT NOT NULL DEFAULT 'roster_import';

UPDATE settings
SET value = '20', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
