import type { FastifyBaseLogger } from "fastify";
import { ensurePuzzle } from "./puzzles";
import { addCalendarDays, shanghaiDate } from "./time";

export function startPuzzleScheduler(log: FastifyBaseLogger) {
  const prepare = async () => {
    const today = shanghaiDate();
    try {
      await ensurePuzzle(today);
      await ensurePuzzle(addCalendarDays(today, 1));
    } catch (error) {
      log.error({ error }, "failed to prepare daily puzzles");
    }
  };
  void prepare();
  const timer = setInterval(prepare, 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
