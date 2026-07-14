import type { Direction, GameState, Point, PuzzleDefinition, RunEvaluation } from "./types";

export const pointKey = (point: Point) => `${point.row},${point.col}`;
export const samePoint = (a: Point, b: Point) => a.row === b.row && a.col === b.col;
export const countSteps = (moves: readonly Point[]) => moves.length;

export const directionBetween = (from: Point, to: Point): Direction | null => {
  const row = to.row - from.row;
  const col = to.col - from.col;
  if (row === -1 && col === 0) return "up";
  if (row === 1 && col === 0) return "down";
  if (row === 0 && col === 1) return "right";
  if (row === 0 && col === -1) return "left";
  return null;
};

const isTurn = (incoming: Direction, outgoing: Direction) =>
  (incoming === "up" || incoming === "down") !==
  (outgoing === "up" || outgoing === "down");

export function createInitialState(puzzle: PuzzleDefinition): GameState {
  return {
    path: [puzzle.start],
    moves: [],
    steps: 0,
    undoCount: 0,
    status: "playing",
  };
}

function portalExit(puzzle: PuzzleDefinition, entrance: Point): Point | undefined {
  const rule = puzzle.rules[pointKey(entrance)];
  if (rule?.type !== "portal") return undefined;
  return Object.entries(puzzle.rules)
    .filter(([key, candidate]) => key !== pointKey(entrance) && candidate.type === "portal" && candidate.pairId === rule.pairId)
    .map(([key]) => {
      const [row, col] = key.split(",").map(Number);
      return { row: row!, col: col! };
    })[0];
}

export function applyMove(
  puzzle: PuzzleDefinition,
  state: GameState,
  target: Point,
): GameState {
  if (state.status !== "playing") return { ...state, error: "本局已经结束" };
  const current = state.path.at(-1)!;
  const direction = directionBetween(current, target);
  if (!direction) return { ...state, error: "只能移动到相邻格" };
  if (
    target.row < 0 || target.row >= puzzle.height ||
    target.col < 0 || target.col >= puzzle.width ||
    puzzle.blocked.includes(pointKey(target))
  ) return { ...state, error: "这个格子无法进入" };

  const currentRule = puzzle.rules[pointKey(current)];
  if (currentRule?.type === "arrow" && currentRule.direction !== direction) {
    return { ...state, error: "必须沿箭头方向离开" };
  }
  if (currentRule?.type === "turn" && state.path.length >= 2) {
    const incoming = directionBetween(state.path[state.path.length - 2]!, current);
    if (incoming && !isTurn(incoming, direction)) {
      return { ...state, error: "这里必须转弯" };
    }
  }
  const visited = new Set(state.path.map(pointKey));
  if (visited.has(pointKey(target))) return { ...state, error: "路径不能重复" };
  const nextSteps = countSteps(state.moves) + 1;
  const targetRule = puzzle.rules[pointKey(target)];
  if (targetRule?.type === "gate" && nextSteps > targetRule.maxStep) {
    return { ...state, error: `必须在第 ${targetRule.maxStep} 步前经过` };
  }

  const appended = [target];
  const exit = portalExit(puzzle, target);
  if (exit) {
    if (visited.has(pointKey(exit))) return { ...state, error: "传送出口已经被占用" };
    appended.push(exit);
  }
  const path = [...state.path, ...appended];
  const completed = samePoint(path.at(-1)!, puzzle.end);
  const requiredMet = puzzle.required.every((key) => path.some((point) => pointKey(point) === key));
  const moves = [...state.moves, target];
  return {
    ...state,
    path,
    moves,
    steps: countSteps(moves),
    status: completed && requiredMet ? "complete" : completed ? "invalid" : "playing",
    error: completed && !requiredMet ? "还有必经格没有连接" : undefined,
  };
}

export function replayMoves(puzzle: PuzzleDefinition, moves: Point[]): GameState {
  return moves.reduce((state, move) => applyMove(puzzle, state, move), createInitialState(puzzle));
}

export function undoMove(puzzle: PuzzleDefinition, state: GameState): GameState {
  if (state.moves.length === 0) return state;
  const replayed = replayMoves(puzzle, state.moves.slice(0, -1));
  return { ...replayed, undoCount: state.undoCount + 1 };
}

export function evaluateRun(
  puzzle: PuzzleDefinition,
  state: GameState,
  elapsedMs: number,
): RunEvaluation {
  const completed = state.status === "complete";
  const pathKeys = state.path.map(pointKey);
  let challenge = false;
  if (completed) {
    switch (puzzle.challenge.type) {
      case "no-undo": challenge = state.undoCount === 0; break;
      case "time": challenge = elapsedMs <= puzzle.challenge.seconds * 1000; break;
      case "collect-stamps": challenge = puzzle.challenge.stampIds.every((stampId) =>
        Object.entries(puzzle.rules).some(([key, rule]) => rule.type === "stamp" && rule.stampId === stampId && pathKeys.includes(key))
      ); break;
      case "ordered": {
        const indexes = puzzle.challenge.cellKeys.map((key) => pathKeys.indexOf(key));
        challenge = indexes.every((index) => index >= 0) && indexes.every((index, position) => position === 0 || index > indexes[position - 1]!);
      }
    }
  }
  const steps = countSteps(state.moves);
  const optimal = completed && steps === puzzle.optimalSteps;
  return {
    valid: completed,
    completed,
    stars: Number(completed) + Number(optimal) + Number(challenge),
    starDetails: { completion: completed, optimal, challenge },
    steps,
    error: state.error,
  };
}
