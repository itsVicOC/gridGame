import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DataType, newDb } from "pg-mem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findShortestSolution, type PuzzleDefinition } from "@pathweave/game";
import { replacePoolForTests } from "./db";
import { buildApp } from "./server";

const memory = newDb();
memory.public.registerFunction({ name: "gen_random_uuid", returns: DataType.uuid, implementation: randomUUID, impure: true });
memory.public.registerFunction({ name: "hashtextextended", args: [DataType.text, DataType.integer], returns: DataType.bigint, implementation: () => 1 });
memory.public.registerFunction({ name: "pg_advisory_xact_lock", args: [DataType.bigint], returns: DataType.integer, implementation: () => 1 });
const adapter = memory.adapters.createPg();
const testPool = new adapter.Pool();
replacePoolForTests(testPool as never);
const app = buildApp();

describe("API 完整成绩链路", () => {
  let token = "";
  let puzzle: PuzzleDefinition;

  beforeAll(async () => {
    for (const migration of ["001_initial.sql", "002_attempt_server_duration.sql", "003_attempt_star_details.sql"]) {
      const sql = await readFile(join(process.cwd(), "migrations", migration), "utf8");
      await testPool.query(sql.replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", ""));
    }
  });

  afterAll(async () => app.close());

  it("创建匿名玩家并返回一次性恢复码", async () => {
    const response = await app.inject({ method: "POST", url: "/v1/players/anonymous" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    token = body.accessToken;
    expect(body.player.shortCode).toHaveLength(6);
    expect(body.recoveryCode.length).toBeGreaterThanOrEqual(12);
  });

  it("由服务端发布同一当日题", async () => {
    const first = await app.inject({ method: "GET", url: "/v1/puzzles/today" });
    const second = await app.inject({ method: "GET", url: "/v1/puzzles/today" });
    expect(first.statusCode).toBe(200);
    puzzle = first.json().puzzle;
    expect(second.json().puzzle).toEqual(puzzle);
  });

  it("重放操作日志、写入榜单并支持幂等重试", async () => {
    const authorization = { authorization: `Bearer ${token}` };
    const started = await app.inject({ method: "POST", url: "/v1/attempts/start", headers: authorization });
    expect(started.statusCode).toBe(200);
    const attempt = started.json();
    await testPool.query("UPDATE attempts SET started_at = now() - interval '5 seconds' WHERE id=$1", [attempt.attemptId]);
    const solution = findShortestSolution(puzzle)!;
    const operationLog = solution.moves.map((target, index) => ({ type: "move", target, elapsedMs: 800 + index * 60 }));
    const payload = { attemptToken: attempt.attemptToken, idempotencyKey: randomUUID(), moves: solution.moves, operationLog };
    const first = await app.inject({ method: "POST", url: `/v1/attempts/${attempt.attemptId}/submit`, headers: authorization, payload });
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json().accepted).toBe(true);
    expect(first.json().result.starDetails.completion).toBe(true);
    const retry = await app.inject({ method: "POST", url: `/v1/attempts/${attempt.attemptId}/submit`, headers: authorization, payload });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().idempotent).toBe(true);
    expect(retry.json().result.starDetails).toEqual(first.json().result.starDetails);
    const puzzleDate = puzzle.date!;
    const daily = await testPool.query("SELECT stars,steps,duration_ms FROM daily_best_scores WHERE puzzle_date=$1", [puzzleDate]);
    expect(daily.rows[0].stars).toBe(first.json().result.stars);
    const season = await testPool.query("SELECT total_stars,completed_days FROM season_scores WHERE season_month=$1", [puzzleDate.slice(0, 7)]);
    expect(season.rows[0]).toMatchObject({ total_stars: first.json().result.stars, completed_days: 1 });
  });

  it("返回由服务端成绩计算的连续天数", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/players/me", headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().streak).toBe(1);
  });
});
