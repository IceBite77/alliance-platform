CREATE TABLE weekly_events (
  day_of_week INTEGER PRIMARY KEY CHECK (day_of_week BETWEEN 1 AND 7),
  event_name TEXT NOT NULL DEFAULT '',
  event_time TEXT,
  note TEXT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  updated_by_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO weekly_events (day_of_week,event_name,enabled) VALUES
  (1,'',0),(2,'',0),(3,'',0),(4,'',0),(5,'',0),(6,'',0),(7,'',0);
