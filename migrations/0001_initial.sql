PRAGMA foreign_keys = ON;

-- Platform-wide configuration. Values are JSON-compatible strings so new
-- settings can be introduced without changing the schema every time.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One installation currently represents one alliance. Keeping alliance
-- identity in data rather than hard-coding House of Quack makes the project
-- reusable as a template for other alliances.
CREATE TABLE alliance (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  tag TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Stable player IDs mean a player can change their display name without
-- breaking historical statistics or references.
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  rank INTEGER NOT NULL DEFAULT 1 CHECK (rank BETWEEN 1 AND 5),
  base_level INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  joined_at TEXT,
  left_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_players_active_name
ON players(display_name COLLATE NOCASE)
WHERE is_active = 1;

-- Away periods are separate records so historical absences can be retained.
CREATE TABLE player_away (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  note TEXT,
  recorded_by_player_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by_player_id) REFERENCES players(id) ON DELETE SET NULL
);

CREATE INDEX idx_player_away_player_dates
ON player_away(player_id, start_date, end_date);

-- A player may have up to four squads. Unit-specific details can be expanded
-- later without forcing those concepts into the player record itself.
CREATE TABLE player_squads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  squad_number INTEGER NOT NULL CHECK (squad_number BETWEEN 1 AND 4),
  power INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE (player_id, squad_number)
);

-- Overlord is normally assigned to a squad; Tactical Drone applies across
-- squads. A generic companion table leaves room for future Last War systems.
CREATE TABLE player_companions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  companion_type TEXT NOT NULL,
  level INTEGER,
  power INTEGER,
  assigned_squad INTEGER CHECK (assigned_squad BETWEEN 1 AND 4),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE (player_id, companion_type)
);

INSERT INTO alliance (id, name, tag)
VALUES (1, 'My Alliance', NULL);

INSERT INTO settings (key, value)
VALUES ('schema_version', '1');
