PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO permissions (permission_key, name, description, category, is_protected) VALUES
  ('settings.details', 'Alliance Details', 'View and manage alliance details.', 'Settings', 0),
  ('settings.branding', 'Branding', 'View and manage alliance branding.', 'Settings', 0),
  ('settings.discord', 'Discord', 'View and manage Discord integration settings.', 'Settings', 0),
  ('settings.ranks', 'Rank Settings', 'View and manage alliance rank settings.', 'Settings', 0),
  ('settings.players', 'Player Settings', 'View and manage player settings.', 'Settings', 0);

INSERT OR IGNORE INTO group_permissions (group_id, permission_id)
SELECT gp.group_id, child.id
FROM group_permissions gp
JOIN permissions broad ON broad.id=gp.permission_id AND broad.permission_key='settings.manage'
JOIN permissions child ON child.permission_key IN ('settings.details','settings.branding','settings.discord','settings.ranks','settings.players');

UPDATE settings SET value='15', updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
