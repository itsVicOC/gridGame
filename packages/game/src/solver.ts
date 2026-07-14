import { applyMove, createInitialState, pointKey } from "./engine";
import type { Point, PuzzleDefinition, SolutionSummary } from "./types";

const directions: Point[] = [
  { row: -1, col: 0 }, { row: 0, col: 1 },
  { row: 1, col: 0 }, { row: 0, col: -1 },
];

export function solvePuzzle(
  puzzle: PuzzleDefinition,
  limit = 200,
  maxNodes = 250_000,
): SolutionSummary[] {
  const solutions: SolutionSummary[] = [];
  let nodes = 0;
  const initial = createInitialState(puzzle);

  function visit(state: ReturnType<typeof createInitialState>) {
    if (++nodes > maxNodes || solutions.length >= limit) return;
    if (state.status === "complete") {
      solutions.push({ moves: state.moves, path: state.path, steps: state.steps });
      return;
    }
    if (state.status !== "playing") return;
    const current = state.path.at(-1)!;
    for (const offset of directions) {
      const target = { row: current.row + offset.row, col: current.col + offset.col };
      const next = applyMove(puzzle, state, target);
      if (next.error || next.moves.length === state.moves.length) continue;
      visit(next);
    }
  }
  visit(initial);
  return solutions.sort((left, right) => left.steps - right.steps);
}

export function validatePuzzle(puzzle: PuzzleDefinition) {
  const solutions = solvePuzzle(puzzle);
  const optimal = solutions[0]?.steps;
  const optimalCount = optimal === undefined ? 0 : solutions.filter((solution) => solution.steps === optimal).length;
  const portalPairs = new Map<string, number>();
  for (const rule of Object.values(puzzle.rules)) {
    if (rule.type === "portal") portalPairs.set(rule.pairId, (portalPairs.get(rule.pairId) ?? 0) + 1);
  }
  return {
    valid: solutions.length >= 2 && optimalCount === 1 && [...portalPairs.values()].every((count) => count === 2),
    solutionCount: solutions.length,
    optimalSteps: optimal,
    optimalCount,
    occupiedKeys: new Set(solutions.flatMap((solution) => solution.path.map(pointKey))),
  };
}
