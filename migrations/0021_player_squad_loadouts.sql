PRAGMA foreign_keys = ON;

CREATE TABLE player_squad_drones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  squad_number INTEGER NOT NULL CHECK (squad_number BETWEEN 1 AND 4),
  level INTEGER,
  power INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE (player_id, squad_number)
);

ALTER TABLE player_roster_snapshots ADD COLUMN squad_2_power INTEGER;
ALTER TABLE player_roster_snapshots ADD COLUMN squad_3_power INTEGER;
ALTER TABLE player_roster_snapshots ADD COLUMN squad_4_power INTEGER;

INSERT OR IGNORE INTO settings (key, value)
VALUES ('player_max_overlord_level', '6');

UPDATE settings
SET value = '21', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
