ALTER TABLE player_roster_snapshots ADD COLUMN recorded_by_name TEXT;

UPDATE settings SET value='46',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
