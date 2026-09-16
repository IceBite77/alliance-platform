-- The site name is alliance-facing wording, distinct from the product name.
-- Preserve any name an installation has already customised.
INSERT INTO settings (key,value,updated_at)
VALUES ('platform_name','The Pond',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  value='The Pond',
  updated_at=CURRENT_TIMESTAMP
WHERE trim(settings.value) IN ('','Alliance Platform','The Alliance Management Platform');
