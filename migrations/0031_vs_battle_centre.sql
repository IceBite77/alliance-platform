PRAGMA foreign_keys = ON;

CREATE TABLE vs_days (
  competition_date TEXT PRIMARY KEY,
  challenge_name TEXT NOT NULL,
  daily_target INTEGER NOT NULL DEFAULT 7200000,
  updated_by_account_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE vs_scores (
  competition_date TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  points INTEGER NOT NULL CHECK(points >= 0),
  PRIMARY KEY (competition_date, player_id),
  FOREIGN KEY (competition_date) REFERENCES vs_days(competition_date) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX idx_vs_scores_player_date ON vs_scores(player_id, competition_date DESC);

INSERT OR IGNORE INTO settings (key,value) VALUES ('player_vs_daily_target','7200000');

UPDATE settings SET value='31',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
