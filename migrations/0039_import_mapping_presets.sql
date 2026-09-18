PRAGMA foreign_keys = ON;

CREATE TABLE import_mapping_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  dataset_type TEXT NOT NULL CHECK(dataset_type IN ('vs_history','desert_storm_history')),
  name TEXT NOT NULL,
  mapping_json TEXT NOT NULL,
  created_by_account_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  UNIQUE(dataset_type,name COLLATE NOCASE)
);

CREATE INDEX idx_import_mapping_presets_dataset ON import_mapping_presets(dataset_type,name);

UPDATE settings SET value='39',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
