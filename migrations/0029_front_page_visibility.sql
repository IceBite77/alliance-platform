PRAGMA foreign_keys = ON;

-- Front-page visibility is permission-driven so approved members can see the
-- general dashboard while sensitive player-level information is granted only
-- through deliberate Access Group membership.
INSERT OR IGNORE INTO permissions (permission_key,name,description,category,is_protected) VALUES
  ('front.rankings.view','Front Page Rankings','View named player power rankings on the alliance front page.','Front Page',0),
  ('front.shield_drops.view','Front Page Shield Drops','View named players recorded as losing their shield on the alliance front page.','Front Page',0),
  ('front.away_details.view','Front Page Away Details','View the names of players currently recorded as away on the alliance front page.','Front Page',0);

UPDATE settings SET value='29',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
