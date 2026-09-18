ALTER TABLE alliance_train_schedule ADD COLUMN recorded_by_name TEXT;
ALTER TABLE shield_drop_incidents ADD COLUMN recorded_by_name TEXT;

UPDATE settings SET value='45',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
