PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO permissions (permission_key, name, description, category, is_protected) VALUES
  ('screenshot_import.roster', 'Roster and Hero Power Screenshots', 'Import weekly roster and total hero power data from screenshots.', 'Screenshot Imports', 0),
  ('screenshot_import.vs', 'VS Score Screenshots', 'Import daily VS scores from screenshots.', 'Screenshot Imports', 0),
  ('screenshot_import.ds', 'Desert Storm Screenshots', 'Import Desert Storm selections and fight results from screenshots.', 'Screenshot Imports', 0);

UPDATE settings SET value='40',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
