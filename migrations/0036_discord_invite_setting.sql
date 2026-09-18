PRAGMA foreign_keys = ON;

INSERT INTO settings(key,value,updated_at)
SELECT 'discord_invite_url','https://discord.gg/Cy7Bb4TGr',CURRENT_TIMESTAMP
FROM alliance
WHERE id=1 AND LOWER(COALESCE(tag,''))='duck'
ON CONFLICT(key) DO NOTHING;

UPDATE settings SET value='36',updated_at=CURRENT_TIMESTAMP WHERE key='schema_version';
