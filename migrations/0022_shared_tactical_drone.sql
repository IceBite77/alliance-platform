PRAGMA foreign_keys = ON;

INSERT INTO player_companions (player_id, companion_type, level, power, assigned_squad)
SELECT player_id, 'tactical_drone', MAX(level), NULL, NULL
FROM player_squad_drones
WHERE level IS NOT NULL
GROUP BY player_id
ON CONFLICT(player_id, companion_type) DO UPDATE SET
  level = excluded.level,
  power = NULL,
  assigned_squad = NULL,
  updated_at = CURRENT_TIMESTAMP;

DROP TABLE player_squad_drones;

UPDATE settings
SET value = '22', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
