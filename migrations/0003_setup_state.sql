PRAGMA foreign_keys = ON;

INSERT INTO settings (key, value)
VALUES
  ('setup_complete', 'false'),
  ('alliance_timezone', 'UTC'),
  ('platform_name', 'Alliance Platform')
ON CONFLICT(key) DO NOTHING;

UPDATE settings
SET value = '3', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
