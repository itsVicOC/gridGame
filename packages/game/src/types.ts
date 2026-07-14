export type Direction = "up" | "right" | "down" | "left";

export interface Point {
  row: number;
  col: number;
}

export type Challenge =
  | { type: "no-undo"; label: string }
  | { type: "time"; seconds: number; label: string }
  | { type: "collect-stamps"; stampIds: string[]; label: string }
  | { type: "ordered"; cellKeys: string[]; label: string };

export type CellRule =
  | { type: "arrow"; direction: Direction }
  | { type: "portal"; pairId: string }
  | { type: "turn" }
  | { type: "gate"; maxStep: number }
  | { type: "stamp"; stampId: string };

export interface PuzzleDefinition {
  id: string;
  date?: string;
  title: string;
  width: number;
  height: number;
  start: Point;
  end: Point;
  blocked: string[];
  required: string[];
  rules: Record<string, CellRule>;
  challenge: Challenge;
  optimalSteps: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  generatorVersion: string;
  rulesVersion: string;
  tutorial?: string;
}

export interface MoveLog {
  type: "move" | "undo" | "reset";
  target?: Point;
  elapsedMs: number;
}

export interface GameState {
  path: Point[];
  moves: Point[];
  steps: number;
  undoCount: number;
  status: "playing" | "complete" | "invalid";
  error?: string;
}

export interface RunEvaluation {
  valid: boolean;
  completed: boolean;
  stars: number;
  starDetails: { completion: boolean; optimal: boolean; challenge: boolean };
  steps: number;
  error?: string;
}

export interface SolutionSummary {
  moves: Point[];
  path: Point[];
  steps: number;
}
