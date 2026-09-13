PRAGMA foreign_keys = ON;

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  account_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT,
  user_agent TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_account ON sessions(account_id, expires_at);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

UPDATE settings
SET value = '5', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
