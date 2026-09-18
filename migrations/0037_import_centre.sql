PRAGMA foreign_keys = ON;

CREATE TABLE import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  dataset_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','rolled_back')),
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by_account_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rolled_back_by_account_id INTEGER,
  rolled_back_at TEXT,
  FOREIGN KEY(created_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY(rolled_back_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE import_batch_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT NOT NULL,
  FOREIGN KEY(batch_id) REFERENCES import_batches(id) ON DELETE CASCADE,
  UNIQUE(batch_id,entity_type,entity_key)
);

CREATE TABLE import_row_fingerprints (
  dataset_type TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  batch_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(dataset_type,fingerprint),
  FOREIGN KEY(batch_id) REFERENCES import_batches(id) ON DELETE CASCADE
);

CREATE INDEX idx_import_batches_created ON import_batches(created_at DESC,id DESC);
CREATE INDEX idx_import_changes_batch ON import_batch_changes(batch_id);

UPDATE settings SET value='37',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
