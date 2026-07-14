import pg from "pg";
import { config } from "./config";

export let pool = new pg.Pool({ connectionString: config.databaseUrl, max: 15 });

export function replacePoolForTests(nextPool: pg.Pool) {
  if (process.env.NODE_ENV !== "test") throw new Error("Database pool replacement is test-only");
  pool = nextPool;
}

export async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
