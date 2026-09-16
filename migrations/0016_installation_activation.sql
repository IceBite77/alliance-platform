PRAGMA foreign_keys = ON;

-- Every deployed copy of The Alliance Management Platform is its own
-- installation. Activation is deliberately separate from Owner bootstrap:
-- activation answers "is this installation authorised?" while the Owner
-- account answers "who controls this installation?".
CREATE TABLE IF NOT EXISTS installation_activation (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  installation_id TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL DEFAULT 'ICE' CHECK (key_prefix = 'ICE'),
  key_fingerprint TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  activated_at TEXT,
  last_verified_at TEXT,
  certificate TEXT,
  activation_service TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The installation ID is local and contains no alliance/player identity.
-- It is safe to create before an alliance or Owner has been configured.
INSERT INTO installation_activation (id, installation_id, status)
VALUES (1, lower(hex(randomblob(16))), 'pending')
ON CONFLICT(id) DO NOTHING;

INSERT INTO settings (key, value)
VALUES
  ('installation_activation_required', 'true'),
  ('installation_key_prefix', 'ICE')
ON CONFLICT(key) DO NOTHING;

UPDATE settings
SET value = '16', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
