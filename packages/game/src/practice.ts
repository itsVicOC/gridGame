import { solvePuzzle } from "./solver";
import type { PuzzleDefinition } from "./types";

type Draft = Omit<PuzzleDefinition, "optimalSteps" | "generatorVersion" | "rulesVersion">;
const defaults = { generatorVersion: "practice-2", rulesVersion: "1.1.0" };

const drafts: Draft[] = [
  {
    id: "practice-1", title: "第一笔", tutorial: "从「起」开始，逐格连接到「终」。只能上下左右移动。",
    width: 3, height: 3, start: { row: 2, col: 0 }, end: { row: 0, col: 2 }, blocked: ["1,0"], required: [], rules: {}, difficulty: 1,
    challenge: { type: "no-undo", label: "不撤销完成" },
  },
  {
    id: "practice-2", title: "经过圆点", tutorial: "深色圆点是必经格。到达终点前，路径必须覆盖它。",
    width: 4, height: 4, start: { row: 3, col: 0 }, end: { row: 0, col: 3 }, blocked: ["0,0", "1,0", "2,2"], required: ["1,2"], rules: {}, difficulty: 1,
    challenge: { type: "no-undo", label: "不撤销完成" },
  },
  {
    id: "practice-3", title: "路不回头", tutorial: "已经画过的格子不能再次进入；走错时使用「撤一步」。",
    width: 4, height: 4, start: { row: 3, col: 0 }, end: { row: 0, col: 3 }, blocked: ["0,0", "1,0", "2,2"], required: ["2,1", "0,2"], rules: {}, difficulty: 1,
    challenge: { type: "no-undo", label: "一笔完成，不使用撤销" },
  },
  {
    id: "practice-4", title: "单向街", tutorial: "进入箭头格后，下一步必须沿箭头指向离开。",
    width: 4, height: 4, start: { row: 3, col: 0 }, end: { row: 0, col: 3 }, blocked: ["0,0", "1,0", "2,2"], required: ["0,2"], rules: { "3,1": { type: "arrow", direction: "right" } }, difficulty: 2,
    challenge: { type: "no-undo", label: "不撤销完成" },
  },
  {
    id: "practice-5", title: "必须转弯", tutorial: "弯角符号要求路径在该格改变方向，不能直穿。",
    width: 4, height: 4, start: { row: 3, col: 0 }, end: { row: 0, col: 3 }, blocked: ["0,0", "1,0", "2,2"], required: ["0,2"], rules: { "0,1": { type: "turn" } }, difficulty: 2,
    challenge: { type: "no-undo", label: "不撤销完成" },
  },
  {
    id: "practice-6", title: "及时赶到", tutorial: "限步门上的数字表示最迟进入步数，路径太绕会被挡住。",
    width: 4, height: 4, start: { row: 3, col: 0 }, end: { row: 0, col: 3 }, blocked: ["0,0", "1,0", "2,2"], required: ["0,2"], rules: { "1,2": { type: "gate", maxStep: 5 } }, difficulty: 2,
    challenge: { type: "no-undo", label: "不撤销完成" },
  },
  {
    id: "practice-7", title: "秘密门", tutorial: "进入字母相同的传送门，会立刻从另一端出现；传送整体算一步。",
    width: 4, height: 4, start: { row: 3, col: 0 }, end: { row: 0, col: 3 }, blocked: ["0,0", "1,0", "2,2"], required: ["0,2"], rules: { "3,2": { type: "portal", pairId: "a" }, "1,2": { type: "portal", pairId: "a" } }, difficulty: 3,
    challenge: { type: "no-undo", label: "不撤销完成" },
  },
  {
    id: "practice-8", title: "捎上邮戳", tutorial: "印章是可选支线。完成路径时顺便收集它，就能获得挑战星。",
    width: 5, height: 5, start: { row: 4, col: 0 }, end: { row: 0, col: 4 }, blocked: ["0,0", "0,2", "0,3", "2,0", "2,1", "3,2"], required: ["2,2"], rules: { "3,4": { type: "stamp", stampId: "daily" } }, difficulty: 3,
    challenge: { type: "collect-stamps", stampIds: ["daily"], label: "捎上支线邮戳" },
  },
  {
    id: "practice-9", title: "先后有序", tutorial: "标记需要按提示顺序经过；路线相同，经过顺序也会影响挑战星。",
    width: 5, height: 5, start: { row: 4, col: 0 }, end: { row: 0, col: 4 }, blocked: ["0,0", "0,2", "0,3", "2,0", "2,1", "3,2"], required: ["2,2"], rules: {}, difficulty: 3,
    challenge: { type: "ordered", cellKeys: ["4,3", "2,2"], label: "先经过右下标记，再经过中央标记" },
  },
  {
    id: "practice-10", title: "双重提示", tutorial: "箭头和转弯格可以叠加影响路线。先观察，再开始画线。",
    width: 5, height: 5, start: { row: 4, col: 0 }, end: { row: 0, col: 4 }, blocked: ["0,0", "1,3", "1,4", "2,0", "3,2", "3,3", "4,1"], required: ["2,2", "0,2"], rules: { "3,0": { type: "arrow", direction: "right" }, "2,2": { type: "turn" } }, difficulty: 4,
    challenge: { type: "no-undo", label: "不撤销完成" },
  },
  {
    id: "practice-11", title: "远路与近路", tutorial: "通关不等于最优。寻找唯一的最短路径，拿到第二颗星。",
    width: 5, height: 5, start: { row: 4, col: 0 }, end: { row: 0, col: 4 }, blocked: ["0,0", "0,2", "0,3", "2,0", "2,1", "3,2"], required: ["2,2", "1,3"], rules: { "4,1": { type: "arrow", direction: "right" }, "2,2": { type: "turn" }, "4,3": { type: "gate", maxStep: 5 } }, difficulty: 4,
    challenge: { type: "time", seconds: 90, label: "90 秒内完成" },
  },
  {
    id: "practice-12", title: "毕业拼图", tutorial: "综合运用必经格、箭头、转弯、限步门和印章，完成三星挑战。",
    width: 5, height: 5, start: { row: 4, col: 0 }, end: { row: 0, col: 4 }, blocked: ["0,1", "1,3", "1,4", "2,4", "3,1", "3,3", "4,2"], required: ["2,2", "0,2"], rules: { "3,0": { type: "arrow", direction: "up" }, "2,2": { type: "turn" }, "2,1": { type: "gate", maxStep: 5 }, "1,1": { type: "stamp", stampId: "daily" } }, difficulty: 5,
    challenge: { type: "collect-stamps", stampIds: ["daily"], label: "收集毕业邮戳" },
  },
];

export const practicePuzzles: PuzzleDefinition[] = drafts.map((draft) => {
  const puzzle: PuzzleDefinition = { ...defaults, ...draft, optimalSteps: 0 };
  const optimal = solvePuzzle(puzzle, 1)[0]?.steps;
  if (optimal === undefined) throw new Error(`Practice puzzle ${puzzle.id} has no solution`);
  return { ...puzzle, optimalSteps: optimal };
});
