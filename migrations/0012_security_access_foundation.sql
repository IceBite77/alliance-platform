PRAGMA foreign_keys = ON;

-- Platform access is deliberately separate from Last War R1-R5 rank.
-- Remove the original rank-derived grants before Security & Access becomes live.
DELETE FROM rank_permissions;

-- Capabilities needed by the approval and protected-rank workflows.
INSERT OR IGNORE INTO permissions (permission_key, name, description, category, is_protected) VALUES
  ('players.approve_changes', 'Approve player changes', 'Approve identity changes such as player rename requests and account-to-player matching.', 'Players', 0),
  ('players.manage_protected_rank', 'Manage protected rank', 'Promote a player to R5, demote an R5, or otherwise change an R5 player rank.', 'Players', 1);

-- Platform roles are permission groups, not game ranks.
INSERT OR IGNORE INTO permission_groups (public_id, name, description, is_system) VALUES
  ('group-administrators', 'Administrators', 'Platform administrators. Access is assigned deliberately and is never inferred from game rank.', 1),
  ('group-members', 'Members', 'Standard signed-in alliance members.', 1);

-- Members receive only normal member capabilities.
INSERT OR IGNORE INTO group_permissions (group_id, permission_id)
SELECT g.id,p.id FROM permission_groups g CROSS JOIN permissions p
WHERE g.public_id='group-members'
AND p.permission_key IN ('profile.view','profile.edit_own','away.manage_own','vs.view','ds.view');

-- Administrators receive normal management capabilities. Protected capabilities
-- are assigned separately so an Administrator does not automatically gain them.
INSERT OR IGNORE INTO group_permissions (group_id, permission_id)
SELECT g.id,p.id FROM permission_groups g CROSS JOIN permissions p
WHERE g.public_id='group-administrators'
AND p.permission_key IN (
  'profile.view','profile.edit_own','players.edit','players.manage_membership',
  'players.approve_changes','away.manage_own','away.manage_all','vs.view','vs.manage',
  'ds.view','ds.manage','intelligence.view','audit.view','accounts.manage'
);

UPDATE settings SET value='12', updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
