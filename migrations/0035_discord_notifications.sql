PRAGMA foreign_keys = ON;
CREATE TABLE discord_notification_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  discord_message_id TEXT NOT NULL,
  posted_by_account_id INTEGER,
  posted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(posted_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  UNIQUE(notification_type,source_key)
);
CREATE INDEX idx_discord_posts_type_date ON discord_notification_posts(notification_type,posted_at DESC);
UPDATE settings SET value='35',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
