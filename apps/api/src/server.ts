import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { config } from "./config";
import { pool } from "./db";
import { routes } from "./routes";
import { startPuzzleScheduler } from "./scheduler";

export function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 128 * 1024, trustProxy: true });
  app.register(helmet);
  app.register(cors, { origin: config.allowedOrigin.split(","), credentials: false });
  app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.register(routes);
  if (process.env.NODE_ENV !== "test") {
    const stopScheduler = startPuzzleScheduler(app.log);
    app.addHook("onClose", async () => stopScheduler());
  }
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ message: "请求格式不正确", issues: error.issues });
    request.log.error(error);
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    const message = error instanceof Error ? error.message : "请求失败";
    return reply.code(status).send({ message: status >= 500 ? "服务器暂时开小差了" : message });
  });
  app.addHook("onClose", async () => pool.end());
  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = buildApp();
  await app.listen({ port: config.port, host: config.host });
}
