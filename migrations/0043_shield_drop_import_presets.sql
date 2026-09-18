PRAGMA foreign_keys = OFF;

CREATE TABLE import_mapping_presets_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  dataset_type TEXT NOT NULL CHECK(dataset_type IN ('vs_history','desert_storm_history','shield_drop_history')),
  name TEXT NOT NULL,
  mapping_json TEXT NOT NULL,
  created_by_account_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  UNIQUE(dataset_type,name COLLATE NOCASE)
);

INSERT INTO import_mapping_presets_new
  (id,public_id,dataset_type,name,mapping_json,created_by_account_id,created_at,updated_at)
SELECT id,public_id,dataset_type,name,mapping_json,created_by_account_id,created_at,updated_at
FROM import_mapping_presets;

DROP TABLE import_mapping_presets;
ALTER TABLE import_mapping_presets_new RENAME TO import_mapping_presets;
CREATE INDEX idx_import_mapping_presets_dataset ON import_mapping_presets(dataset_type,name);

PRAGMA foreign_keys = ON;
UPDATE settings SET value='43',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
