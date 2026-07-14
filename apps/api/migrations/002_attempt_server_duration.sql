ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS server_duration_ms integer;
