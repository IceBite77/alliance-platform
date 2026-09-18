PRAGMA foreign_keys = ON;
CREATE TABLE shield_drop_incidents (id INTEGER PRIMARY KEY AUTOINCREMENT,war_date TEXT NOT NULL,player_id INTEGER NOT NULL,incident_time TEXT,note TEXT,recorded_by_account_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,FOREIGN KEY(recorded_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL);
CREATE INDEX idx_shield_drops_date_player ON shield_drop_incidents(war_date DESC,player_id);
INSERT OR IGNORE INTO permissions (permission_key,name,description,category,is_protected) VALUES ('shield_drops.manage','Manage Shield Drops','Record and remove Saturday war-day shield-loss incidents.','Operations',0);
UPDATE settings SET value='33',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
