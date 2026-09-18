PRAGMA foreign_keys = ON;

UPDATE permissions SET category='Data Imports',name='Screenshots · Roster and Hero Power' WHERE permission_key='screenshot_import.roster';
UPDATE permissions SET category='Data Imports',name='Screenshots · VS Scores' WHERE permission_key='screenshot_import.vs';
UPDATE permissions SET category='Data Imports',name='Screenshots · Desert Storm' WHERE permission_key='screenshot_import.ds';

INSERT OR IGNORE INTO permissions (permission_key,name,description,category,is_protected) VALUES
  ('file_import.roster','Files · Player Roster','Import player roster data from Excel or CSV files.','Data Imports',0),
  ('file_import.vs','Files · VS History','Import historical VS data from Excel or CSV files.','Data Imports',0),
  ('file_import.ds','Files · Desert Storm History','Import historical Desert Storm data from Excel or CSV files.','Data Imports',0);

UPDATE settings SET value='41',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
