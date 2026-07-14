import { GENERATOR_VERSION, generateDailyPuzzle, type PuzzleDefinition } from "@pathweave/game";
import type pg from "pg";
import { pool } from "./db";
import { shanghaiDate } from "./time";

export async function ensurePuzzle(date = shanghaiDate(), client: pg.Pool | pg.PoolClient = pool): Promise<PuzzleDefinition> {
  const today = shanghaiDate();
  const existing = await client.query("SELECT definition,generator_version,status FROM puzzles WHERE puzzle_date = $1", [date]);
  if (existing.rows[0]) {
    const row = existing.rows[0];
    if (date > today && row.status === "scheduled" && row.generator_version !== GENERATOR_VERSION) {
      const replacement = generateDailyPuzzle(date);
      const updated = await client.query(
        `UPDATE puzzles SET id=$1,generator_version=$2,rules_version=$3,definition=$4,optimal_steps=$5
         WHERE puzzle_date=$6 AND status='scheduled' RETURNING definition`,
        [replacement.id, replacement.generatorVersion, replacement.rulesVersion, replacement, replacement.optimalSteps, date],
      );
      if (updated.rows[0]) return updated.rows[0].definition as PuzzleDefinition;
    }
    if (date <= today && row.status === "scheduled") await client.query("UPDATE puzzles SET status='published' WHERE puzzle_date=$1", [date]);
    return row.definition as PuzzleDefinition;
  }
  const puzzle = generateDailyPuzzle(date);
  const status = date <= today ? "published" : "scheduled";
  const inserted = await client.query(
    `INSERT INTO puzzles(id, puzzle_date, generator_version, rules_version, definition, optimal_steps, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (puzzle_date) DO UPDATE SET puzzle_date = EXCLUDED.puzzle_date
     RETURNING definition`,
    [puzzle.id, date, puzzle.generatorVersion, puzzle.rulesVersion, puzzle, puzzle.optimalSteps, status],
  );
  return inserted.rows[0].definition as PuzzleDefinition;
}
