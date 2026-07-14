import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db";

const here = dirname(fileURLToPath(import.meta.url));
const migrationDir = join(here, "../migrations");

await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
for (const name of (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort()) {
  const exists = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
  if (exists.rowCount) continue;
  const sql = await readFile(join(migrationDir, name), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [name]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
await pool.end();
