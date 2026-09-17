PRAGMA foreign_keys = ON;

CREATE TABLE player_away_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  player_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  note TEXT,
  created_by_account_id INTEGER,
  updated_by_account_id INTEGER,
  cancelled_at TEXT,
  cancelled_by_account_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (cancelled_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_player_away_periods_player ON player_away_periods(player_id,start_date DESC);
CREATE INDEX idx_player_away_periods_dates ON player_away_periods(start_date,end_date,cancelled_at);

UPDATE settings SET value='26', updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';

