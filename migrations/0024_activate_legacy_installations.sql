PRAGMA foreign_keys = ON;

-- Migration 0016 introduced activation after established installations
-- already had an Owner. Grandfather only those legacy installations.
-- A fresh installation reaches this migration before an Owner exists and
-- therefore remains pending until a valid ICE key is supplied.
UPDATE installation_activation
SET status = 'active',
    activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP),
    last_verified_at = COALESCE(last_verified_at, CURRENT_TIMESTAMP),
    activation_service = COALESCE(activation_service, 'legacy-grandfathered'),
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1
  AND status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM accounts
    WHERE is_owner = 1
  );

UPDATE settings
SET value = '24', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
