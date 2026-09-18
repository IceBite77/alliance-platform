PRAGMA foreign_keys = ON;

CREATE TABLE player_name_change_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  requested_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  requested_by_account_id INTEGER NOT NULL,
  reviewed_by_account_id INTEGER,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(requested_by_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY(reviewed_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_player_name_requests_pending
ON player_name_change_requests(player_id)
WHERE status='pending';

CREATE TABLE player_name_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  old_name TEXT NOT NULL,
  new_name TEXT NOT NULL,
  approved_by_account_id INTEGER,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(approved_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_player_name_history_player ON player_name_history(player_id,changed_at DESC);
UPDATE settings SET value='34',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
