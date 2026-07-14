export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
  databaseUrl: process.env.DATABASE_URL ?? "postgres://pathweave:pathweave@localhost:5432/pathweave",
  jwtSecret: process.env.JWT_SECRET ?? "development-secret-change-me-please-32-bytes",
  allowedOrigin: process.env.ALLOWED_ORIGIN ?? "http://localhost:5173",
  attemptTtlMinutes: Number(process.env.ATTEMPT_TTL_MINUTES ?? 15),
};
