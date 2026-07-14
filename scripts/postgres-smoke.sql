BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE name = '003_attempt_star_details.sql') THEN
    RAISE EXCEPTION 'latest migration is missing';
  END IF;
END $$;

EXPLAIN (COSTS OFF)
SELECT rank() OVER (ORDER BY stars DESC, steps ASC, duration_ms ASC, achieved_at ASC)
FROM daily_best_scores
WHERE puzzle_date = CURRENT_DATE;

SELECT pg_advisory_xact_lock(hashtextextended('pathweave-smoke', 0));

ROLLBACK;
