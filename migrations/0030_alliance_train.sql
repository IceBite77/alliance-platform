PRAGMA foreign_keys = ON;

CREATE TABLE alliance_train_schedule (
  schedule_date TEXT PRIMARY KEY,
  driver_player_id INTEGER NOT NULL,
  vip_player_id INTEGER,
  updated_by_account_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_player_id) REFERENCES players(id) ON DELETE RESTRICT,
  FOREIGN KEY (vip_player_id) REFERENCES players(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_alliance_train_driver_date
ON alliance_train_schedule(driver_player_id, schedule_date DESC);

INSERT OR IGNORE INTO permissions (permission_key,name,description,category,is_protected) VALUES
  ('train.manage','Manage Alliance Train','Create and update the Alliance Train driver and VIP schedule.','Operations',0),
  ('front.train.view','Front Page Train','View today’s Train driver and VIP on the alliance front page.','Front Page',0);

UPDATE settings SET value='30',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
