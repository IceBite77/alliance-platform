-- Account security blocks are deliberately separate from access approval.
-- Reject = access decision. Block = security decision.
CREATE TABLE IF NOT EXISTS account_security_blocks (
  account_id INTEGER PRIMARY KEY,
  reason TEXT,
  blocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  blocked_by_account_id INTEGER,
  unblocked_at TEXT,
  unblocked_by_account_id INTEGER,
  FOREIGN KEY(account_id) REFERENCES accounts(id),
  FOREIGN KEY(blocked_by_account_id) REFERENCES accounts(id),
  FOREIGN KEY(unblocked_by_account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_account_security_blocks_active
  ON account_security_blocks(unblocked_at, blocked_at);

INSERT OR REPLACE INTO schema_version(version, applied_at)
VALUES (14, CURRENT_TIMESTAMP);
