import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../config/env";
import {
  getDatabaseConnectivityErrorCode,
  isDatabaseConnectivityError,
  summarizeDatabaseConnection,
} from "../shared/db/connectivity";
import { logger } from "../shared/logger";
import * as schema from "./schema";

export const databaseConnectionSummary = summarizeDatabaseConnection(
  env.DATABASE_URL,
);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
  ...(databaseConnectionSummary.sslRequired
    ? {
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {}),
});

pool.on("error", (error) => {
  if (isDatabaseConnectivityError(error)) {
    logger.warn("Database pool emitted a connectivity error", {
      code: getDatabaseConnectivityErrorCode(error),
      host: databaseConnectionSummary.host,
      mode: databaseConnectionSummary.mode,
      message: error.message,
    });
    return;
  }

  logger.error("Database pool emitted an unexpected error", {
    message: error.message,
    stack: error.stack,
  });
});

export const db = drizzle(pool, { schema });

export const verifyDatabaseConnection = async () => {
  const client = await pool.connect();

  try {
    await client.query("select 1");
  } finally {
    client.release();
  }
};
