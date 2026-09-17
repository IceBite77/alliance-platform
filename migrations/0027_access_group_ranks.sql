PRAGMA foreign_keys = ON;

-- Ranks never own permissions directly. A rank may be deliberately attached
-- to an Access Group, which keeps the group as the source of authority while
-- allowing membership to follow a player's current R1-R5 rank.
CREATE TABLE permission_group_ranks (
  group_id INTEGER NOT NULL,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 5),
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  added_by_account_id INTEGER,
  PRIMARY KEY (group_id, rank),
  FOREIGN KEY (group_id) REFERENCES permission_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_permission_group_ranks_rank
ON permission_group_ranks(rank, group_id);

UPDATE settings SET value='27', updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
