import { describe, expect, it } from "vitest";
import { applyMove, createInitialState, evaluateRun, replayMoves, undoMove } from "./engine";
import { challengeCompletionCount, difficultyForDate, fallbackPuzzle, generateDailyPuzzle } from "./generator";
import { practicePuzzles } from "./practice";
import { solvePuzzle, validatePuzzle } from "./solver";

describe("规则引擎", () => {
  it("拒绝斜向、阻挡和重复移动", () => {
    const puzzle = fallbackPuzzle("2026-07-15");
    const initial = createInitialState(puzzle);
    expect(applyMove(puzzle, initial, { row: 2, col: 1 }).error).toBe("只能移动到相邻格");
    expect(applyMove(puzzle, initial, { row: 4, col: 0 }).error).toBe("这个格子无法进入");
  });

  it("完成路径并由服务端规则计算星数", () => {
    const puzzle = fallbackPuzzle("2026-07-15");
    const state = replayMoves(puzzle, [
      { row: 3, col: 1 }, { row: 2, col: 1 }, { row: 1, col: 1 },
      { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
    ]);
    expect(state.status).toBe("complete");
    expect(evaluateRun(puzzle, state, 20_000).stars).toBe(3);
  });

  it("同一日期生成稳定题目", () => {
    expect(generateDailyPuzzle("2026-07-15")).toEqual(generateDailyPuzzle("2026-07-15"));
  });

  it("全部练习关都有合法解", () => {
    for (const puzzle of practicePuzzles) {
      const solutions = solvePuzzle(puzzle, 1);
      expect(solutions, puzzle.id).not.toHaveLength(0);
      expect(solutions[0]?.steps, `${puzzle.id} optimal`).toBe(puzzle.optimalSteps);
    }
  });

  it("整月每日题保持唯一最短解且挑战可完成", () => {
    const puzzles = Array.from({ length: 31 }, (_, index) =>
      generateDailyPuzzle(`2026-08-${String(index + 1).padStart(2, "0")}`),
    );
    expect(new Set(puzzles.map((puzzle) => JSON.stringify([puzzle.blocked, puzzle.required, puzzle.start]))).size).toBeGreaterThan(20);
    for (const puzzle of puzzles) {
      const validation = validatePuzzle(puzzle);
      expect(validation.valid, puzzle.id).toBe(true);
      expect(validation.optimalSteps, puzzle.id).toBe(puzzle.optimalSteps);
      expect(puzzle.difficulty, `${puzzle.id} difficulty`).toBe(difficultyForDate(puzzle.date!));
      const challengePossible = solvePuzzle(puzzle).some((solution) =>
        evaluateRun(puzzle, replayMoves(puzzle, solution.moves), 0).starDetails.challenge,
      );
      expect(challengePossible, `${puzzle.id} challenge`).toBe(true);
      if (puzzle.challenge.type === "collect-stamps" || puzzle.challenge.type === "ordered") {
        expect(challengeCompletionCount(puzzle), `${puzzle.id} selective challenge`).toBeLessThan(validation.solutionCount);
      }
    }
  });

  it("高难度每日题包含传送机制", () => {
    const sundays = ["2026-08-02", "2026-08-09", "2026-08-16", "2026-08-23"];
    expect(sundays.some((date) => Object.values(generateDailyPuzzle(date).rules).some((rule) => rule.type === "portal"))).toBe(true);
  });

  it("一周难度从周一向周末提升", () => {
    expect(["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09"].map(difficultyForDate)).toEqual([1, 2, 2, 3, 3, 4, 5]);
  });

  it("多次撤销会累积计数", () => {
    const puzzle = fallbackPuzzle("2026-07-15");
    let state = replayMoves(puzzle, [{ row: 3, col: 1 }, { row: 2, col: 1 }]);
    state = undoMove(puzzle, state);
    state = undoMove(puzzle, state);
    expect(state.undoCount).toBe(2);
  });
});
