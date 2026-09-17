PRAGMA foreign_keys = ON;

ALTER TABLE players ADD COLUMN total_hero_power INTEGER;

CREATE TABLE player_roster_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  total_strength INTEGER,
  squad_1_power INTEGER,
  total_hero_power INTEGER,
  recorded_by_account_id INTEGER,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_player_roster_snapshots_player_date
ON player_roster_snapshots(player_id, recorded_at DESC, id DESC);

UPDATE settings
SET value = '19', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
