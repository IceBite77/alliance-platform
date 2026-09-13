-- Store the Last War server number as part of the alliance identity.
ALTER TABLE alliance ADD COLUMN server_number INTEGER CHECK (server_number IS NULL OR server_number > 0);

UPDATE settings
SET value = '10', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
