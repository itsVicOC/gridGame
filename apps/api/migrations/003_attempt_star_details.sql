ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS star_details jsonb;
