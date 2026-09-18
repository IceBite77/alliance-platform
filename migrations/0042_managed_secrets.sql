PRAGMA foreign_keys = ON;

-- Owner-managed operational secrets. Values are AES-GCM encrypted with a key
-- derived from the installation's Cloudflare AUTH_SECRET. Plaintext is never
-- stored in D1 or written to the audit log.
CREATE TABLE IF NOT EXISTS managed_secrets (
  secret_key TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  configured_by_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  configured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

UPDATE settings
SET value = '42', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
