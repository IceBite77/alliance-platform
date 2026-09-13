PRAGMA foreign_keys = ON;

-- Login identities are deliberately separate from player records. An account
-- can optionally be linked to a player while retaining its own stable identity.
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  player_id INTEGER UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  is_owner INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL
);

-- Authentication providers are kept separate so an installation can support
-- Discord, email or other identity providers without changing the account model.
CREATE TABLE account_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  provider_username TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE (provider, provider_subject)
);

-- Permission keys are data, not hard-coded rank rules. Protected permissions
-- are intended for installation-owner level operations.
CREATE TABLE permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  permission_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  is_protected INTEGER NOT NULL DEFAULT 0 CHECK (is_protected IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default permissions for Last War R1-R5. These can be changed through the
-- future permission-matrix UI without changing application code.
CREATE TABLE rank_permissions (
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 5),
  permission_id INTEGER NOT NULL,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by_account_id INTEGER,
  PRIMARY KEY (rank, permission_id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Custom groups allow trusted players to receive extra access regardless of
-- their in-game R1-R5 rank.
CREATE TABLE permission_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_permissions (
  group_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by_account_id INTEGER,
  PRIMARY KEY (group_id, permission_id),
  FOREIGN KEY (group_id) REFERENCES permission_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE account_groups (
  account_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  added_by_account_id INTEGER,
  PRIMARY KEY (account_id, group_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES permission_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Per-account grants/exceptions allow a trusted individual to receive a
-- specific capability without changing their rank or adding a new group.
-- effect supports both explicit grants and explicit denies.
CREATE TABLE account_permission_overrides (
  account_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  reason TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by_account_id INTEGER,
  PRIMARY KEY (account_id, permission_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Append-only application audit trail. actor_account_id identifies who made
-- the change; subject_player_id identifies whose game record was affected.
-- old_values/new_values are JSON text containing only the fields that changed.
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_account_id INTEGER,
  actor_display_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  subject_player_id INTEGER,
  source TEXT NOT NULL DEFAULT 'web',
  old_values TEXT,
  new_values TEXT,
  metadata TEXT,
  FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (subject_player_id) REFERENCES players(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_log_occurred_at ON audit_log(occurred_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_account_id, occurred_at DESC);
CREATE INDEX idx_audit_log_subject_player ON audit_log(subject_player_id, occurred_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id, occurred_at DESC);

-- Initial permission catalogue. The UI will manage assignments rather than
-- relying on these being permanently tied to particular ranks.
INSERT INTO permissions (permission_key, name, description, category, is_protected) VALUES
  ('profile.view', 'View player profiles', 'View player profile information available to members.', 'Players', 0),
  ('profile.edit_own', 'Edit own profile', 'Update the player profile linked to the signed-in account.', 'Players', 0),
  ('players.edit', 'Edit players', 'Update other player records and game statistics.', 'Players', 0),
  ('players.manage_membership', 'Manage membership', 'Add players and manage join, leave and active status.', 'Players', 0),
  ('away.manage_own', 'Manage own away status', 'Create or update personal away periods.', 'Away', 0),
  ('away.manage_all', 'Manage all away status', 'Manage away periods for any player.', 'Away', 0),
  ('vs.view', 'View VS data', 'View VS competition data and history.', 'VS', 0),
  ('vs.manage', 'Manage VS data', 'Enter, correct and manage VS competition data.', 'VS', 0),
  ('ds.view', 'View Desert Storm data', 'View Desert Storm selections, results and history.', 'Desert Storm', 0),
  ('ds.manage', 'Manage Desert Storm data', 'Enter, correct and manage Desert Storm data.', 'Desert Storm', 0),
  ('intelligence.view', 'View intelligence', 'View alliance intelligence and leadership analysis.', 'Intelligence', 0),
  ('audit.view', 'View audit log', 'View recorded player, leadership and system changes.', 'Administration', 0),
  ('permissions.manage', 'Manage permissions', 'Manage rank, group and individual permission assignments.', 'Administration', 1),
  ('accounts.manage', 'Manage accounts', 'Invite, disable and manage application accounts.', 'Administration', 1),
  ('settings.manage', 'Manage alliance settings', 'Change alliance-wide configuration and branding.', 'Administration', 1),
  ('integrations.manage', 'Manage integrations', 'Configure Discord and other external integrations.', 'Administration', 1),
  ('system.manage', 'Manage platform', 'Manage installation-level platform configuration.', 'System', 1),
  ('system.transfer_owner', 'Transfer ownership', 'Transfer installation ownership to another account.', 'System', 1);

-- Sensible minimum defaults. These are editable later; they are seed data,
-- not permanent application rules.
INSERT INTO rank_permissions (rank, permission_id)
SELECT 1, id FROM permissions
WHERE permission_key IN ('profile.view', 'profile.edit_own', 'away.manage_own', 'vs.view', 'ds.view');

INSERT INTO rank_permissions (rank, permission_id)
SELECT 2, id FROM permissions
WHERE permission_key IN ('profile.view', 'profile.edit_own', 'away.manage_own', 'vs.view', 'ds.view');

INSERT INTO rank_permissions (rank, permission_id)
SELECT 3, id FROM permissions
WHERE permission_key IN ('profile.view', 'profile.edit_own', 'away.manage_own', 'vs.view', 'ds.view');

INSERT INTO rank_permissions (rank, permission_id)
SELECT 4, id FROM permissions
WHERE permission_key IN (
  'profile.view', 'profile.edit_own', 'players.edit', 'players.manage_membership',
  'away.manage_own', 'away.manage_all', 'vs.view', 'vs.manage', 'ds.view',
  'ds.manage', 'intelligence.view', 'audit.view'
);

INSERT INTO rank_permissions (rank, permission_id)
SELECT 5, id FROM permissions
WHERE is_protected = 0;

INSERT INTO permission_groups (public_id, name, description, is_system)
VALUES
  ('group-leadership', 'Leadership', 'Optional extra access for alliance leadership.', 1),
  ('group-trusted', 'Trusted Members', 'Trusted players who can be given selected additional access.', 1);

UPDATE settings SET value = '2', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
