import { randomUUID } from "node:crypto";
import { applyMove, createInitialState, evaluateRun, pointKey, undoMove, type GameState, type MoveLog, type Point, type PuzzleDefinition } from "@pathweave/game";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { attemptToken, hashSecret, playerToken, recoveryCode, requirePlayer, shortCode, verifyToken } from "./auth";
import { config } from "./config";
import { pool, transaction } from "./db";
import { ensurePuzzle } from "./puzzles";
import { updateBestScore } from "./ranking";
import { addCalendarDays, shanghaiDate, shanghaiMonth } from "./time";

const pointSchema = z.object({ row: z.number().int().min(0).max(12), col: z.number().int().min(0).max(12) });

function replayOperationLog(puzzle: PuzzleDefinition, log: MoveLog[], serverDurationMs: number) {
  let state = createInitialState(puzzle);
  let valid = true;
  let previousElapsed = -1;
  for (const event of log) {
    if (event.elapsedMs < previousElapsed || event.elapsedMs > serverDurationMs + 1_000) valid = false;
    previousElapsed = event.elapsedMs;
    if (event.type === "reset") {
      const resetState = createInitialState(puzzle);
      resetState.undoCount = state.undoCount + 1;
      state = resetState;
      continue;
    }
    if (event.type === "undo") { state = undoMove(puzzle, state); continue; }
    if (!event.target) { valid = false; continue; }
    const next = applyMove(puzzle, state, event.target);
    if (next.moves.length === state.moves.length) valid = false;
    else state = next;
  }
  return { state, valid, activeDurationMs: Math.max(previousElapsed, 0) };
}

function sameMoves(left: Point[], right: Point[]) {
  return left.length === right.length && left.every((point, index) => pointKey(point) === pointKey(right[index]!));
}

export async function routes(app: FastifyInstance) {
  const accountKey = (request: { headers: { authorization?: string }; ip: string }) => request.headers.authorization ?? request.ip;
  const sensitiveWrite = { config: { rateLimit: { max: 12, timeWindow: "1 minute", keyGenerator: accountKey } } };
  const frequentWrite = { config: { rateLimit: { max: 40, timeWindow: "1 minute", keyGenerator: accountKey } } };
  app.get("/health", async () => ({ ok: true, date: shanghaiDate(), version: "1.1.0" }));

  app.post("/v1/players/anonymous", sensitiveWrite, async () => {
    const recovery = recoveryCode();
    return transaction(async (client) => {
      let player;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          player = (await client.query("INSERT INTO players(short_code) VALUES($1) RETURNING id,nickname,short_code,credential_version", [shortCode()])).rows[0];
          break;
        } catch (error: unknown) {
          if ((error as { code?: string }).code !== "23505") throw error;
        }
      }
      if (!player) throw new Error("无法创建玩家编号");
      await client.query("INSERT INTO recovery_credentials(player_id,secret_hash) VALUES($1,$2)", [player.id, hashSecret(recovery)]);
      return { player: { id: player.id, nickname: player.nickname, shortCode: player.short_code }, accessToken: await playerToken(player.id, player.credential_version), recoveryCode: recovery };
    });
  });

  app.post("/v1/players/recover", sensitiveWrite, async (request, reply) => {
    const { recoveryCode: code } = z.object({ recoveryCode: z.string().min(12).max(100) }).parse(request.body);
    const result = await transaction(async (client) => {
      const credential = (await client.query(
        `SELECT p.id,p.nickname,p.short_code,p.credential_version,rc.id credential_id FROM recovery_credentials rc
         JOIN players p ON p.id=rc.player_id WHERE rc.secret_hash=$1 AND rc.revoked_at IS NULL FOR UPDATE`, [hashSecret(code)],
      )).rows[0];
      if (!credential) return undefined;
      const nextRecovery = recoveryCode();
      await client.query("UPDATE recovery_credentials SET revoked_at=now() WHERE id=$1", [credential.credential_id]);
      await client.query("UPDATE players SET credential_version=credential_version+1,updated_at=now() WHERE id=$1", [credential.id]);
      await client.query("INSERT INTO recovery_credentials(player_id,secret_hash) VALUES($1,$2)", [credential.id, hashSecret(nextRecovery)]);
      return { player: { id: credential.id, nickname: credential.nickname, shortCode: credential.short_code }, accessToken: await playerToken(credential.id, credential.credential_version + 1), recoveryCode: nextRecovery };
    });
    if (!result) return reply.code(401).send({ message: "恢复码无效或已使用" });
    return result;
  });

  app.patch("/v1/players/me", sensitiveWrite, async (request) => {
    const player = await requirePlayer(request);
    const { nickname } = z.object({ nickname: z.string().trim().min(2).max(12).regex(/^[\p{L}\p{N}_·\- ]+$/u) }).parse(request.body);
    const blocked = ["管理员", "官方", "admin", "system"];
    if (blocked.some((word) => nickname.toLowerCase().includes(word))) throw Object.assign(new Error("这个昵称不能使用"), { statusCode: 400 });
    const result = await pool.query("UPDATE players SET nickname=$1,updated_at=now() WHERE id=$2 AND credential_version=$3 RETURNING nickname,short_code", [nickname, player.id, player.version]);
    if (!result.rowCount) throw Object.assign(new Error("身份已失效，请重新恢复"), { statusCode: 401 });
    return { nickname: result.rows[0].nickname, shortCode: result.rows[0].short_code };
  });

  app.get("/v1/players/me", async (request) => {
    const player = await requirePlayer(request);
    const profile = (await pool.query(
      `SELECT id,nickname,short_code FROM players WHERE id=$1`, [player.id],
    )).rows[0];
    const today = shanghaiDate();
    const completedDates = (await pool.query(
      `SELECT puzzle_date FROM daily_best_scores WHERE player_id=$1 AND puzzle_date <= $2 ORDER BY puzzle_date DESC`,
      [player.id, today],
    )).rows.map((row) => row.puzzle_date instanceof Date ? row.puzzle_date.toISOString().slice(0, 10) : String(row.puzzle_date).slice(0, 10));
    const latest = completedDates[0];
    let streak = 0;
    if (latest === today || latest === addCalendarDays(today, -1)) {
      let expected = latest;
      for (const date of completedDates) {
        if (date !== expected) break;
        streak++;
        expected = addCalendarDays(expected, -1);
      }
    }
    return { player: { id: profile.id, nickname: profile.nickname, shortCode: profile.short_code }, streak };
  });

  app.get("/v1/puzzles/today", async () => {
    const date = shanghaiDate();
    return { date, puzzle: await ensurePuzzle(date), serverTime: new Date().toISOString(), minClientVersion: "1.1.0" };
  });

  app.post("/v1/attempts/start", frequentWrite, async (request) => {
    const player = await requirePlayer(request);
    const date = shanghaiDate();
    const puzzle = await ensurePuzzle(date);
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + config.attemptTtlMinutes * 60_000);
    await pool.query("INSERT INTO attempts(id,player_id,puzzle_id,expires_at) VALUES($1,$2,$3,$4)", [id, player.id, puzzle.id, expiresAt]);
    return { attemptId: id, attemptToken: await attemptToken(id, player.id, expiresAt), startedAt: new Date().toISOString(), expiresAt: expiresAt.toISOString() };
  });

  app.post("/v1/attempts/:id/submit", frequentWrite, async (request, reply) => {
    const player = await requirePlayer(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      attemptToken: z.string(), idempotencyKey: z.string().min(8).max(100),
      moves: z.array(pointSchema).max(150),
      operationLog: z.array(z.object({ type: z.enum(["move", "undo", "reset"]), target: pointSchema.optional(), elapsedMs: z.number().int().min(0) })).max(500),
    }).parse(request.body);
    const token = await verifyToken(body.attemptToken);
    if (token.type !== "attempt" || token.sub !== params.id || token.playerId !== player.id) return reply.code(401).send({ message: "尝试令牌无效" });

    return transaction(async (client) => {
      const existing = await client.query("SELECT stars,steps,duration_ms,valid,rejection_reason,star_details FROM attempts WHERE player_id=$1 AND idempotency_key=$2", [player.id, body.idempotencyKey]);
      if (existing.rows[0]) {
        const saved = existing.rows[0];
        return { accepted: saved.valid, result: { stars: saved.stars, steps: saved.steps, durationMs: saved.duration_ms, starDetails: saved.star_details, rejectionReason: saved.rejection_reason }, idempotent: true };
      }
      const attempt = (await client.query(
        `SELECT a.*,p.definition,p.puzzle_date FROM attempts a JOIN puzzles p ON p.id=a.puzzle_id
         WHERE a.id=$1 AND a.player_id=$2 FOR UPDATE`, [params.id, player.id],
      )).rows[0];
      if (!attempt || attempt.submitted_at) return reply.code(409).send({ message: "尝试已提交或不存在" });
      const submittedAt = new Date();
      const serverDurationMs = submittedAt.getTime() - new Date(attempt.started_at).getTime();
      const expired = submittedAt > new Date(attempt.expires_at);
      const replay = replayOperationLog(attempt.definition, body.operationLog as MoveLog[], serverDurationMs);
      const state: GameState = replay.state;
      const durationMs = replay.activeDurationMs;
      const evaluation = evaluateRun(attempt.definition, state, durationMs);
      const plausibleLog = replay.valid && sameMoves(state.moves, body.moves as Point[]);
      const plausibleTiming = durationMs >= Math.max(750, state.moves.length * 45) && durationMs <= serverDurationMs + 1_000;
      const valid = !expired && plausibleLog && plausibleTiming && evaluation.valid;
      const rejection = expired ? "尝试已过期" : !plausibleLog ? "操作日志不完整" : !plausibleTiming ? "完成时间异常" : evaluation.error;
      await client.query(
        `UPDATE attempts SET submitted_at=$1,idempotency_key=$2,moves=$3,operation_log=$4,stars=$5,steps=$6,
          duration_ms=$7,server_duration_ms=$8,valid=$9,rejection_reason=$10,star_details=$11 WHERE id=$12`,
        [submittedAt, body.idempotencyKey, JSON.stringify(body.moves), JSON.stringify(body.operationLog), evaluation.stars, evaluation.steps, durationMs, serverDurationMs, valid, rejection, evaluation.starDetails, params.id],
      );
      let improved = false;
      if (valid) improved = await updateBestScore(client, { date: attempt.definition.date, playerId: player.id, attemptId: params.id, stars: evaluation.stars, steps: evaluation.steps, durationMs, achievedAt: submittedAt });
      return { accepted: valid, improved, result: { ...evaluation, durationMs, rejectionReason: rejection } };
    });
  });

  async function leaderboard(scope: "daily" | "season", key: string, playerId?: string) {
    const daily = scope === "daily";
    const order = daily ? "s.stars DESC,s.steps ASC,s.duration_ms ASC,s.achieved_at ASC" : "s.total_stars DESC,s.total_steps ASC,s.total_duration_ms ASC";
    const where = daily ? "s.puzzle_date=$1" : "s.season_month=$1";
    const table = daily ? "daily_best_scores" : "season_scores";
    const rows = await pool.query(
      `SELECT p.id,p.nickname,p.short_code,${daily ? "s.stars,s.steps,s.duration_ms" : "s.total_stars,s.total_steps,s.total_duration_ms,s.completed_days"},
       rank() OVER(ORDER BY ${order})::int rank FROM ${table} s JOIN players p ON p.id=s.player_id WHERE ${where} ORDER BY ${order} LIMIT 100`, [key],
    );
    let nearby: unknown[] = [];
    if (playerId) {
      const result = await pool.query(
        `WITH ranked AS (SELECT p.id,p.nickname,p.short_code,${daily ? "s.stars,s.steps,s.duration_ms" : "s.total_stars,s.total_steps,s.total_duration_ms,s.completed_days"},
          rank() OVER(ORDER BY ${order})::int rank FROM ${table} s JOIN players p ON p.id=s.player_id WHERE ${where})
         SELECT * FROM ranked WHERE rank BETWEEN GREATEST((SELECT rank FROM ranked WHERE id=$2)-2,1) AND (SELECT rank FROM ranked WHERE id=$2)+2 ORDER BY rank`, [key, playerId],
      );
      nearby = result.rows;
    }
    return { key, top: rows.rows, nearby };
  }

  app.get("/v1/leaderboards/daily/:date", async (request) => {
    const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(request.params);
    const player = request.headers.authorization ? await requirePlayer(request) : undefined;
    return leaderboard("daily", date, player?.id);
  });
  app.get("/v1/leaderboards/seasons/:month", async (request) => {
    const { month } = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(request.params);
    const player = request.headers.authorization ? await requirePlayer(request) : undefined;
    return { ...(await leaderboard("season", month, player?.id)), current: month === shanghaiMonth() };
  });
}
