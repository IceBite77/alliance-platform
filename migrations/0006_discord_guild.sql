PRAGMA foreign_keys = ON;

CREATE TABLE discord_guild_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  guild_id TEXT NOT NULL UNIQUE,
  guild_name TEXT NOT NULL,
  guild_icon TEXT,
  connected_by_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

UPDATE settings
SET value = '6', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
