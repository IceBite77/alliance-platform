PRAGMA foreign_keys = ON;

CREATE TABLE alliance_ranks (
  rank_level INTEGER PRIMARY KEY CHECK (rank_level BETWEEN 1 AND 5),
  display_name TEXT NOT NULL,
  image_path TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO alliance_ranks (rank_level, display_name) VALUES
  (1, 'R1'),
  (2, 'R2'),
  (3, 'R3'),
  (4, 'R4'),
  (5, 'R5');

UPDATE settings
SET value = '7', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
