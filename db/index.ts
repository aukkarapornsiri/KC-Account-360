import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __kcAccountPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the PostgreSQL database.");
  }

  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX || 20),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 10_000),
    statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS || 30_000),
    application_name: "kc-account-360",
  });
}

export function getPool() {
  if (!globalThis.__kcAccountPool) globalThis.__kcAccountPool = createPool();
  return globalThis.__kcAccountPool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}
