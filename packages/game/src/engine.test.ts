import { describe, expect, it } from "vitest";
import { applyMove, countSteps, createInitialState, evaluateRun, replayMoves, undoMove } from "./engine";
import { challengeCompletionCount, difficultyForDate, fallbackPuzzle, generateDailyPuzzle } from "./generator";
import { practicePuzzles } from "./practice";
import { findShortestSolution, findShortestSolutions, solvePuzzle, validatePuzzle } from "./solver";

describe("规则引擎", () => {
  it("拒绝斜向、阻挡和重复移动", () => {
    const puzzle = fallbackPuzzle("2026-07-15");
    const initial = createInitialState(puzzle);
    expect(applyMove(puzzle, initial, { row: 2, col: 1 }).error).toBe("只能移动到相邻格");
    expect(applyMove(puzzle, initial, { row: 4, col: 0 }).error).toBe("这个格子无法进入");
  });

  it("完成路径并由服务端规则计算星数", () => {
    const puzzle = fallbackPuzzle("2026-07-15");
    const state = replayMoves(puzzle, findShortestSolution(puzzle)!.moves);
    expect(state.status).toBe("complete");
    expect(evaluateRun(puzzle, state, 20_000).stars).toBe(3);
  });

  it("同一日期生成稳定题目", () => {
    expect(generateDailyPuzzle("2026-07-15")).toEqual(generateDailyPuzzle("2026-07-15"));
  });

  it("备用题保留多解且最短解唯一", () => {
    const puzzle = fallbackPuzzle("2026-06-14");
    const validation = validatePuzzle(puzzle);
    expect(validation.valid).toBe(true);
    expect(validation.solutionCount).toBeGreaterThan(1);
    expect(validation.optimalCount).toBe(1);
    expect(validation.optimalSteps).toBe(puzzle.optimalSteps);
  });

  it("全部练习关都有合法解", () => {
    for (const puzzle of practicePuzzles) {
      const shortest = findShortestSolution(puzzle);
      expect(shortest, puzzle.id).toBeDefined();
      expect(shortest?.steps, `${puzzle.id} optimal`).toBe(puzzle.optimalSteps);
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

  it("全年每日题与备用题都通过发布校验", () => {
    const start = new Date("2026-01-01T12:00:00Z");
    for (let index = 0; index < 365; index++) {
      const date = new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10);
      const puzzle = generateDailyPuzzle(date);
      const validation = validatePuzzle(puzzle);
      expect(validation.valid, puzzle.id).toBe(true);
      expect(validation.optimalSteps, puzzle.id).toBe(puzzle.optimalSteps);
      expect(challengeCompletionCount(puzzle), `${puzzle.id} challenge`).toBeGreaterThan(0);
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

  it("最短搜索不把 DFS 第一条较长路径当作最优", () => {
    const puzzle = practicePuzzles[1]!;
    const firstDepthFirst = solvePuzzle(puzzle, 1)[0]!;
    const shortest = findShortestSolution(puzzle)!;
    expect(firstDepthFirst.steps).toBeGreaterThan(shortest.steps);
    expect(shortest.steps).toBe(6);
    expect(puzzle.optimalSteps).toBe(6);
  });

  it("精确统计最短解数量", () => {
    const puzzle = practicePuzzles[0]!;
    const shortest = findShortestSolutions(puzzle);
    expect(shortest.length).toBeGreaterThan(1);
    expect(new Set(shortest.map((solution) => solution.steps))).toEqual(new Set([puzzle.optimalSteps]));
  });

  it("传送门占用两格但只计算一次主动移动", () => {
    const puzzle = practicePuzzles[6]!;
    const shortest = findShortestSolution(puzzle)!;
    const state = replayMoves(puzzle, shortest.moves);
    expect(state.path.length - 1).toBeGreaterThan(state.steps);
    expect(state.steps).toBe(state.moves.length);
    expect(countSteps(state.moves)).toBe(puzzle.optimalSteps);
  });

  it("提前进入终点遗漏必经格后不可继续但可以撤回", () => {
    const puzzle = fallbackPuzzle("2026-07-15");
    const state = replayMoves(puzzle, [
      { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 },
      { row: 2, col: 3 }, { row: 1, col: 3 }, { row: 0, col: 3 },
    ]);
    expect(state.status).toBe("invalid");
    expect(state.error).toBe("还有必经格没有连接");
    expect(applyMove(puzzle, state, { row: 0, col: 2 }).moves).toEqual(state.moves);
    expect(undoMove(puzzle, state).path.at(-1)).toEqual({ row: 1, col: 3 });
  });
});
