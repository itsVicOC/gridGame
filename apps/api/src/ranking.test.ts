import { describe, expect, it } from "vitest";
import { isBetterScore } from "./ranking";
import { updateBestScore } from "./ranking";
import { addCalendarDays, shanghaiDate } from "./time";

describe("排行榜规则", () => {
  it("按星数、步数和用时比较", () => {
    const previous = { stars: 2, steps: 9, duration_ms: 10_000 };
    expect(isBetterScore({ stars: 3, steps: 20, durationMs: 50_000 }, previous)).toBe(true);
    expect(isBetterScore({ stars: 2, steps: 8, durationMs: 50_000 }, previous)).toBe(true);
    expect(isBetterScore({ stars: 2, steps: 9, durationMs: 9_000 }, previous)).toBe(true);
    expect(isBetterScore({ stars: 1, steps: 2, durationMs: 100 }, previous)).toBe(false);
  });

  it("北京时间日界线稳定", () => {
    expect(shanghaiDate(new Date("2026-07-14T16:00:00.000Z"))).toBe("2026-07-15");
    expect(addCalendarDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("更新成绩前先取得玩家日期锁，并从每日最佳重算赛季", async () => {
    const queries: string[] = [];
    const client = {
      query: async (sql: string) => {
        queries.push(sql.replace(/\s+/g, " ").trim());
        if (sql.includes("SELECT stars")) return { rows: [] };
        return { rows: [] };
      },
    };
    await updateBestScore(client as never, { date: "2026-07-15", playerId: "player", attemptId: "attempt", stars: 3, steps: 8, durationMs: 4000, achievedAt: new Date() });
    expect(queries[0]).toContain("pg_advisory_xact_lock");
    expect(queries.at(-1)).toContain("FROM daily_best_scores");
    expect(queries.at(-1)).not.toContain("season_scores.total_stars +");
  });
});
