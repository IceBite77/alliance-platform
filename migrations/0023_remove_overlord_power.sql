PRAGMA foreign_keys = ON;

UPDATE player_companions
SET power = NULL, updated_at = CURRENT_TIMESTAMP
WHERE companion_type = 'overlord' AND power IS NOT NULL;

UPDATE settings
SET value = '23', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
