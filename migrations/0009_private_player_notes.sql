PRAGMA foreign_keys = ON;

CREATE TABLE player_private_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  created_by_account_id INTEGER,
  updated_by_account_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_player_private_notes_player
ON player_private_notes(player_id, updated_at DESC);

INSERT INTO permissions (permission_key, name, description, category, is_protected)
VALUES (
  'players.private_notes',
  'View and manage private player notes',
  'View, add, edit and remove private notes attached to player records.',
  'Players',
  0
);

INSERT INTO rank_permissions (rank, permission_id)
SELECT 4, id FROM permissions WHERE permission_key = 'players.private_notes';

INSERT INTO rank_permissions (rank, permission_id)
SELECT 5, id FROM permissions WHERE permission_key = 'players.private_notes';

UPDATE settings
SET value = '9', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
