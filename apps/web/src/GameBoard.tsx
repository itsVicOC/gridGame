import { useEffect, useMemo, useRef, useState } from "react";
import { applyMove, createInitialState, pointKey, samePoint, undoMove, type GameState, type MoveLog, type Point, type PuzzleDefinition } from "@pathweave/game";
import { CornerDownRight, RotateCcw, Undo2 } from "lucide-react";

interface Props {
  puzzle: PuzzleDefinition;
  disabled?: boolean;
  onChange?: (state: GameState, log: MoveLog[]) => void;
  onComplete: (state: GameState, log: MoveLog[], elapsedMs: number) => void;
}

const arrowGlyph = { up: "↑", right: "→", down: "↓", left: "←" };

export function GameBoard({ puzzle, disabled, onChange, onComplete }: Props) {
  const [state, setState] = useState(() => createInitialState(puzzle));
  const [log, setLog] = useState<MoveLog[]>([]);
  const [dragging, setDragging] = useState(false);
  const startedAt = useRef(performance.now());
  const boardRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const logRef = useRef(log);

  useEffect(() => {
    const initial = createInitialState(puzzle);
    setState(initial); setLog([]); stateRef.current = initial; logRef.current = []; startedAt.current = performance.now();
  }, [puzzle]);
  function handleKeyDown(event: React.KeyboardEvent) {
      if (disabled) return;
      const delta: Record<string, Point> = { ArrowUp: { row: -1, col: 0 }, ArrowDown: { row: 1, col: 0 }, ArrowLeft: { row: 0, col: -1 }, ArrowRight: { row: 0, col: 1 } };
      if (!(event.key in delta)) return;
      event.preventDefault();
      const current = state.path.at(-1)!; const offset = delta[event.key]!;
      move({ row: current.row + offset.row, col: current.col + offset.col });
  }

  function commit(next: GameState, nextLog: MoveLog[]) {
    stateRef.current = next; logRef.current = nextLog;
    setState(next); setLog(nextLog); onChange?.(next, nextLog);
    if (next.status === "complete") onComplete(next, nextLog, Math.round(performance.now() - startedAt.current));
  }
  function move(target: Point) {
    if (disabled) return;
    const currentState = stateRef.current;
    const next = applyMove(puzzle, currentState, target);
    if (next.moves.length === currentState.moves.length) { stateRef.current = next; setState(next); return; }
    commit(next, [...logRef.current, { type: "move", target, elapsedMs: Math.round(performance.now() - startedAt.current) }]);
  }
  function undo() {
    const next = undoMove(puzzle, stateRef.current);
    commit(next, [...logRef.current, { type: "undo", elapsedMs: Math.round(performance.now() - startedAt.current) }]);
  }
  function reset() {
    const resetState = createInitialState(puzzle);
    resetState.undoCount = stateRef.current.undoCount + 1;
    commit(resetState, [...logRef.current, { type: "reset", elapsedMs: Math.round(performance.now() - startedAt.current) }]);
  }
  function pointFromEvent(event: React.PointerEvent) {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-cell]");
    if (!element) return; const [row, col] = element.dataset.cell!.split(",").map(Number);
    return { row: row!, col: col! };
  }

  const polyline = useMemo(() => state.path.map((point) => `${point.col * 100 + 50},${point.row * 100 + 50}`).join(" "), [state.path]);
  const cells = Array.from({ length: puzzle.width * puzzle.height }, (_, index) => ({ row: Math.floor(index / puzzle.width), col: index % puzzle.width }));

  return <section className="game-panel" aria-label="路径拼图">
    <div className="board-meta" aria-live="polite"><span>第 {state.steps} 步</span><span className={state.error ? "error-note" : "rule-note"}>{state.error ?? puzzle.challenge.label}</span></div>
    <div ref={boardRef} className="board" tabIndex={0} style={{ gridTemplateColumns: `repeat(${puzzle.width}, 1fr)`, aspectRatio: `${puzzle.width}/${puzzle.height}` }}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => { setDragging(true); boardRef.current?.setPointerCapture(event.pointerId); const point = pointFromEvent(event); if (point && !samePoint(point, state.path.at(-1)!)) move(point); }}
      onPointerMove={(event) => { if (!dragging) return; const point = pointFromEvent(event); if (point) move(point); }}
      onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
      <svg className="path-layer" viewBox={`0 0 ${puzzle.width * 100} ${puzzle.height * 100}`} aria-hidden="true"><polyline points={polyline} /></svg>
      {cells.map((point) => {
        const key = pointKey(point); const rule = puzzle.rules[key]; const blocked = puzzle.blocked.includes(key);
        const start = key === pointKey(puzzle.start); const end = key === pointKey(puzzle.end); const required = puzzle.required.includes(key);
        const visited = state.path.some((item) => pointKey(item) === key);
        const orderedIndex = puzzle.challenge.type === "ordered" ? puzzle.challenge.cellKeys.indexOf(key) : -1;
        const labels = [`第${point.row + 1}行第${point.col + 1}列`, start ? "起点" : "", end ? "终点" : "", required ? "必经格" : "", rule?.type === "arrow" ? `${arrowGlyph[rule.direction]}箭头` : "", rule?.type === "portal" ? `${rule.pairId}传送门` : "", rule?.type === "turn" ? "必须转弯" : "", rule?.type === "gate" ? `最迟第${rule.maxStep}步进入` : "", rule?.type === "stamp" ? "挑战印章" : "", orderedIndex >= 0 ? `顺序标记${orderedIndex + 1}` : ""].filter(Boolean).join("，");
        return <button key={key} data-cell={key} disabled={blocked || disabled} className={`cell ${blocked ? "blocked" : ""} ${visited ? "visited" : ""} ${required ? "required" : ""}`} aria-label={labels} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); move(point); } }}>
          {start && <span className="endpoint start">起</span>}{end && <span className="endpoint end">终</span>}
          {required && !start && !end && <span className="required-dot" />}
          {rule?.type === "arrow" && <span className="rule arrow">{arrowGlyph[rule.direction]}</span>}
          {rule?.type === "portal" && <span className="rule portal">{rule.pairId.toUpperCase()}</span>}
          {rule?.type === "turn" && <span className="rule"><CornerDownRight size={18} /></span>}
          {rule?.type === "gate" && <span className="rule gate">≤{rule.maxStep}</span>}
          {rule?.type === "stamp" && <span className="rule stamp">印</span>}
          {orderedIndex >= 0 && <span className="order-marker">{orderedIndex + 1}</span>}
        </button>;
      })}
    </div>
    <div className="rule-legend" aria-label="棋盘图例"><span><i className="legend-required"/>必经</span><span>↪ 转弯</span><span>≤n 限步</span><span>◎ 传送</span><span className="legend-stamp">印 挑战</span></div>
    <div className="board-actions"><button className="text-button" onClick={undo} disabled={!state.moves.length || disabled}><Undo2 size={17}/>撤一步</button><button className="text-button" onClick={reset}><RotateCcw size={17}/>重新来</button></div>
  </section>;
}
