import { directionBetween, pointKey } from "./engine";
import { findShortestSolution, solvePuzzle, validatePuzzle } from "./solver";
import type { CellRule, Challenge, Point, PuzzleDefinition, SolutionSummary } from "./types";

export const GENERATOR_VERSION = "2.1.0";
export const RULES_VERSION = "1.1.0";

function hashSeed(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomSource(initialSeed: number) {
  let seed = initialSeed || 1;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function shuffle<T>(values: T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

export function difficultyForDate(date: string): 1 | 2 | 3 | 4 | 5 {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return ([5, 1, 2, 2, 3, 3, 4] as const)[weekday]!;
}

function allPoints(width: number, height: number): Point[] {
  return Array.from({ length: width * height }, (_, index) => ({
    row: Math.floor(index / width), col: index % width,
  }));
}

function createCandidate(date: string, difficulty: 1 | 2 | 3 | 4 | 5, seed: number, attempt: number): PuzzleDefinition {
  const random = randomSource(seed + attempt * 7919);
  const width = 5;
  const rotation = Math.floor(random() * 4);
  const rotate = (point: Point) => {
    let result = point;
    for (let turn = 0; turn < rotation; turn++) result = { row: result.col, col: width - 1 - result.row };
    return result;
  };
  const start = rotate({ row: 4, col: 0 });
  const end = rotate({ row: 0, col: 4 });
  const available = shuffle(allPoints(width, width).filter((point) =>
    pointKey(point) !== pointKey(start) && pointKey(point) !== pointKey(end)
  ), random);
  const blockedCount = 4 + difficulty + Math.floor(random() * 3);
  const blocked = available.slice(0, blockedCount).map(pointKey);
  const open = available.filter((point) => !blocked.includes(pointKey(point)));
  const requiredCount = difficulty >= 4 ? 3 : difficulty >= 2 ? 2 : 1;
  const required = shuffle(open, random).slice(0, requiredCount).map(pointKey);
  return {
    id: `daily-${date}-v${GENERATOR_VERSION}`,
    date,
    title: ["晨光短笺", "风过回廊", "午后折线", "远行邮路", "夜航手记"][difficulty - 1]!,
    width, height: width, start, end, blocked, required, rules: {},
    challenge: { type: "no-undo", label: "一笔笃定：不撤销完成" },
    optimalSteps: 0, difficulty, generatorVersion: GENERATOR_VERSION, rulesVersion: RULES_VERSION,
  };
}

function ruleCandidates(solution: SolutionSummary, difficulty: number): Array<[string, CellRule]> {
  const result: Array<[string, CellRule]> = [];
  if (difficulty >= 2) {
    const index = Math.min(2, solution.path.length - 2);
    const direction = directionBetween(solution.path[index]!, solution.path[index + 1]!);
    if (direction) result.push([pointKey(solution.path[index]!), { type: "arrow", direction }]);
  }
  if (difficulty >= 3) {
    const turn = solution.path.slice(1, -1).find((point, index) => {
      const actualIndex = index + 1;
      const incoming = directionBetween(solution.path[actualIndex - 1]!, point);
      const outgoing = directionBetween(point, solution.path[actualIndex + 1]!);
      return incoming && outgoing && (incoming === "up" || incoming === "down") !== (outgoing === "up" || outgoing === "down");
    });
    if (turn) result.push([pointKey(turn), { type: "turn" }]);
  }
  if (difficulty >= 4) {
    const gateIndex = Math.min(Math.max(3, Math.floor(solution.path.length / 2)), solution.path.length - 2);
    result.push([pointKey(solution.path[gateIndex]!), { type: "gate", maxStep: gateIndex }]);
  }
  return result;
}

function addStableRules(puzzle: PuzzleDefinition, difficulty: number) {
  let current = puzzle;
  const solution = findShortestSolution(current);
  if (!solution) return current;
  for (const [key, rule] of ruleCandidates(solution, difficulty)) {
    if (current.rules[key]) continue;
    const candidate = { ...current, rules: { ...current.rules, [key]: rule } };
    const validation = validatePuzzle(candidate);
    if (validation.valid) current = { ...candidate, optimalSteps: validation.optimalSteps! };
  }
  if (difficulty >= 5) {
    const refreshed = findShortestSolution(current);
    if (refreshed && refreshed.path.length >= 7) {
      const entrance = pointKey(refreshed.path[3]!);
      const exit = pointKey(refreshed.path[4]!);
      if (!current.rules[entrance] && !current.rules[exit]) {
        const portalCandidate = {
          ...current,
          rules: { ...current.rules, [entrance]: { type: "portal", pairId: "a" } as const, [exit]: { type: "portal", pairId: "a" } as const },
        };
        const validation = validatePuzzle(portalCandidate);
        if (validation.valid) current = { ...portalCandidate, optimalSteps: validation.optimalSteps! };
      }
    }
  }
  return current;
}

function pathChallenge(puzzle: PuzzleDefinition, solutions: SolutionSummary[], seed: number): { puzzle: PuzzleDefinition; challenge?: Challenge } {
  const pathSets = solutions.map((solution) => new Set(solution.path.map(pointKey)));
  const usable = allPoints(puzzle.width, puzzle.height)
    .map(pointKey)
    .filter((key) => !puzzle.blocked.includes(key) && !puzzle.required.includes(key) && !puzzle.rules[key])
    .filter((key) => {
      const visits = pathSets.filter((set) => set.has(key)).length;
      return visits > 0 && visits < solutions.length;
    });
  if (usable.length > 0 && seed % 2 === 0) {
    const key = usable[seed % usable.length]!;
    return {
      puzzle: { ...puzzle, rules: { ...puzzle.rules, [key]: { type: "stamp", stampId: "daily" } } },
      challenge: { type: "collect-stamps", stampIds: ["daily"], label: "支线邮戳：捎上今日印章" },
    };
  }
  for (const first of usable) {
    for (const second of usable) {
      if (first === second) continue;
      const matches = solutions.filter((solution) => {
        const keys = solution.path.map(pointKey);
        const firstIndex = keys.indexOf(first); const secondIndex = keys.indexOf(second);
        return firstIndex >= 0 && secondIndex > firstIndex;
      }).length;
      if (matches > 0 && matches < solutions.length) {
        return { puzzle, challenge: { type: "ordered", cellKeys: [first, second], label: "先后有序：依次经过两枚记号" } };
      }
    }
  }
  return { puzzle };
}

function behaviorChallenge(difficulty: number, seed: number): Challenge {
  if (seed % 2 === 0) return { type: "no-undo", label: "一笔笃定：不撤销完成" };
  const seconds = [100, 90, 80, 70, 60][difficulty - 1]!;
  return { type: "time", seconds, label: `从容落笔：${seconds} 秒内完成` };
}

export function generateDailyPuzzle(date: string): PuzzleDefinition {
  const seed = hashSeed(`${date}:${GENERATOR_VERSION}`);
  const difficulty = difficultyForDate(date);
  for (let attempt = 0; attempt < 220; attempt++) {
    const base = createCandidate(date, difficulty, seed, attempt);
    const validation = validatePuzzle(base);
    if (!validation.valid || !validation.optimalSteps) continue;
    let candidate = addStableRules({ ...base, optimalSteps: validation.optimalSteps }, difficulty);
    const solutions = solvePuzzle(candidate);
    const special = pathChallenge(candidate, solutions, seed + attempt);
    candidate = special.puzzle;
    candidate.challenge = special.challenge ?? behaviorChallenge(difficulty, seed + attempt);
    return candidate;
  }
  return fallbackPuzzle(date, difficulty);
}

export function fallbackPuzzle(date: string, difficulty: 1 | 2 | 3 | 4 | 5 = 1): PuzzleDefinition {
  return {
    id: `daily-${date}-fallback`, date, title: "今日小径", width: 4, height: 4,
    start: { row: 3, col: 0 }, end: { row: 0, col: 3 }, blocked: ["0,0", "1,0", "2,2"],
    required: ["0,2"], rules: {
      "0,1": { type: "turn" },
      "1,2": { type: "stamp", stampId: "daily" },
      "2,1": { type: "arrow", direction: "right" },
    },
    challenge: { type: "no-undo", label: "一笔笃定：不撤销完成" }, optimalSteps: 8, difficulty,
    generatorVersion: GENERATOR_VERSION, rulesVersion: RULES_VERSION,
  };
}

export function challengeCompletionCount(puzzle: PuzzleDefinition) {
  const solutions = solvePuzzle(puzzle);
  return solutions.filter((solution) => {
    const keys = solution.path.map(pointKey);
    if (puzzle.challenge.type === "collect-stamps") {
      return puzzle.challenge.stampIds.every((stampId) => Object.entries(puzzle.rules).some(([key, rule]) => rule.type === "stamp" && rule.stampId === stampId && keys.includes(key)));
    }
    if (puzzle.challenge.type === "ordered") {
      const indexes = puzzle.challenge.cellKeys.map((key) => keys.indexOf(key));
      return indexes.every((index) => index >= 0) && indexes.every((index, position) => position === 0 || index > indexes[position - 1]!);
    }
    return true;
  }).length;
}
