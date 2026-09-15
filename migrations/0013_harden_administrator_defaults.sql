PRAGMA foreign_keys = ON;

-- Sensitive capabilities are never inherited merely by becoming an Administrator.
-- They must be granted explicitly by the Owner through Security & Access.
DELETE FROM group_permissions
WHERE group_id=(SELECT id FROM permission_groups WHERE public_id='group-administrators')
AND permission_id IN (
  SELECT id FROM permissions
  WHERE permission_key IN (
    'accounts.manage',
    'settings.manage',
    'permissions.manage',
    'integrations.manage',
    'system.manage',
    'system.transfer_owner',
    'players.manage_protected_rank'
  )
);

UPDATE settings SET value='13', updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
