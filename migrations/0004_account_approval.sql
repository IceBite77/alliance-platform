PRAGMA foreign_keys = ON;

-- Accounts can authenticate with Discord before they are allowed into the
-- alliance. New player accounts will remain pending until an authorised user
-- approves them and links them to the correct player record.
ALTER TABLE accounts ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'active', 'rejected', 'disabled'));
ALTER TABLE accounts ADD COLUMN approved_at TEXT;
ALTER TABLE accounts ADD COLUMN approved_by_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE accounts ADD COLUMN rejected_at TEXT;
ALTER TABLE accounts ADD COLUMN rejection_reason TEXT;

CREATE INDEX idx_accounts_approval_status ON accounts(approval_status, created_at);

-- Approval is intentionally separate from full account administration so it
-- can be granted to R4/R5 or a trusted verification group without granting
-- broader administrative control.
INSERT INTO permissions (permission_key, name, description, category, is_protected)
VALUES (
  'accounts.approve',
  'Approve player accounts',
  'Approve or reject Discord sign-ups and link them to the correct player record.',
  'Administration',
  0
);

INSERT INTO rank_permissions (rank, permission_id)
SELECT 4, id FROM permissions WHERE permission_key = 'accounts.approve';

INSERT INTO rank_permissions (rank, permission_id)
SELECT 5, id FROM permissions WHERE permission_key = 'accounts.approve';

UPDATE settings SET value = '4', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
