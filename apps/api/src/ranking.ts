import type pg from "pg";

export function isBetterScore(next: { stars: number; steps: number; durationMs: number }, previous?: { stars: number; steps: number; duration_ms: number }) {
  if (!previous) return true;
  if (next.stars !== previous.stars) return next.stars > previous.stars;
  if (next.steps !== previous.steps) return next.steps < previous.steps;
  return next.durationMs < previous.duration_ms;
}

export async function updateBestScore(client: pg.PoolClient, score: {
  date: string; playerId: string; attemptId: string; stars: number; steps: number; durationMs: number; achievedAt: Date;
}) {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`daily-best:${score.date}:${score.playerId}`],
  );
  const current = await client.query(
    "SELECT stars, steps, duration_ms FROM daily_best_scores WHERE puzzle_date=$1 AND player_id=$2 FOR UPDATE",
    [score.date, score.playerId],
  );
  if (!isBetterScore(score, current.rows[0])) return false;
  await client.query(
    `INSERT INTO daily_best_scores(puzzle_date,player_id,attempt_id,stars,steps,duration_ms,achieved_at)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(puzzle_date,player_id) DO UPDATE SET attempt_id=EXCLUDED.attempt_id,stars=EXCLUDED.stars,
       steps=EXCLUDED.steps,duration_ms=EXCLUDED.duration_ms,achieved_at=EXCLUDED.achieved_at`,
    [score.date, score.playerId, score.attemptId, score.stars, score.steps, score.durationMs, score.achievedAt],
  );
  const month = score.date.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year!, monthNumber!, 1)).toISOString().slice(0, 10);
  const monthStart = `${month}-01`;
  await client.query(
    `INSERT INTO season_scores(season_month,player_id,total_stars,total_steps,total_duration_ms,completed_days)
     SELECT $1,$2,COALESCE(SUM(stars),0)::int,COALESCE(SUM(steps),0)::int,
       COALESCE(SUM(duration_ms),0)::bigint,COUNT(*)::int
     FROM daily_best_scores
     WHERE player_id=$2 AND puzzle_date >= $3 AND puzzle_date < $4
     ON CONFLICT(season_month,player_id) DO UPDATE SET
       total_stars=EXCLUDED.total_stars,total_steps=EXCLUDED.total_steps,
       total_duration_ms=EXCLUDED.total_duration_ms,completed_days=EXCLUDED.completed_days,updated_at=now()`,
    [month, score.playerId, monthStart, nextMonth],
  );
  return true;
}
