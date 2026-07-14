import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fallbackPuzzle } from "@pathweave/game";
import { GameBoard } from "./GameBoard";

describe("棋盘界面", () => {
  it("绘制完整网格、起终点和特殊格", () => {
    const markup = renderToStaticMarkup(
      <GameBoard puzzle={fallbackPuzzle("2026-07-15")} onComplete={() => undefined} />,
    );
    expect(markup.match(/data-cell=/g)).toHaveLength(16);
    expect(markup).toContain("endpoint start");
    expect(markup).toContain("endpoint end");
    expect(markup).toContain("rule stamp");
    expect(markup).toContain("棋盘图例");
  });
});
