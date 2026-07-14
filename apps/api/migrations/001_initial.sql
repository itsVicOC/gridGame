CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname varchar(20) NOT NULL DEFAULT '旅人',
  short_code char(6) NOT NULL UNIQUE,
  credential_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  secret_hash text NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS puzzles (
  id text PRIMARY KEY,
  puzzle_date date NOT NULL UNIQUE,
  generator_version text NOT NULL,
  rules_version text NOT NULL,
  definition jsonb NOT NULL,
  optimal_steps integer NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled', 'published')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id),
  puzzle_id text NOT NULL REFERENCES puzzles(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  expires_at timestamptz NOT NULL,
  idempotency_key text,
  moves jsonb,
  operation_log jsonb,
  stars smallint,
  steps integer,
  duration_ms integer,
  valid boolean,
  rejection_reason text,
  UNIQUE (player_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS daily_best_scores (
  puzzle_date date NOT NULL,
  player_id uuid NOT NULL REFERENCES players(id),
  attempt_id uuid NOT NULL REFERENCES attempts(id),
  stars smallint NOT NULL,
  steps integer NOT NULL,
  duration_ms integer NOT NULL,
  achieved_at timestamptz NOT NULL,
  PRIMARY KEY (puzzle_date, player_id)
);

CREATE INDEX IF NOT EXISTS daily_rank_idx
  ON daily_best_scores (puzzle_date, stars DESC, steps ASC, duration_ms ASC, achieved_at ASC);

CREATE TABLE IF NOT EXISTS season_scores (
  season_month char(7) NOT NULL,
  player_id uuid NOT NULL REFERENCES players(id),
  total_stars integer NOT NULL DEFAULT 0,
  total_steps integer NOT NULL DEFAULT 0,
  total_duration_ms bigint NOT NULL DEFAULT 0,
  completed_days integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_month, player_id)
);

CREATE INDEX IF NOT EXISTS season_rank_idx
  ON season_scores (season_month, total_stars DESC, total_steps ASC, total_duration_ms ASC);
