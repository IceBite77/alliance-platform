PRAGMA foreign_keys = ON;

CREATE TABLE player_name_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias_name TEXT NOT NULL,
  alias_normalized TEXT NOT NULL UNIQUE,
  player_id INTEGER NOT NULL,
  created_by_account_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_player_name_aliases_player ON player_name_aliases(player_id);

UPDATE settings SET value='38',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
