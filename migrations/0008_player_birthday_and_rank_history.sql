PRAGMA foreign_keys = ON;

ALTER TABLE players ADD COLUMN birthday_month INTEGER CHECK (birthday_month BETWEEN 1 AND 12);
ALTER TABLE players ADD COLUMN birthday_day INTEGER CHECK (birthday_day BETWEEN 1 AND 31);

CREATE TABLE player_rank_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  old_rank INTEGER CHECK (old_rank BETWEEN 1 AND 5),
  new_rank INTEGER NOT NULL CHECK (new_rank BETWEEN 1 AND 5),
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by_account_id INTEGER,
  note TEXT,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_player_rank_history_player
ON player_rank_history(player_id, changed_at DESC);

UPDATE settings
SET value = '8', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
