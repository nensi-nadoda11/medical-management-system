import { readdir, readFile } from "fs/promises";
import path from "path";

import { pool } from "../db/client";
import { logger } from "../shared/logger";

const MIGRATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_migrations (
    id bigserial PRIMARY KEY,
    name varchar(255) NOT NULL UNIQUE,
    executed_at timestamptz NOT NULL DEFAULT now()
  );
`;

const runMigrations = async () => {
  const client = await pool.connect();

  try {
    await client.query(MIGRATIONS_TABLE_SQL);

    const migrationsDirectory = path.resolve(process.cwd(), "drizzle");
    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const alreadyExecuted = await client.query<{ name: string }>(
        "SELECT name FROM app_migrations WHERE name = $1 LIMIT 1",
        [file],
      );

      if (alreadyExecuted.rowCount) {
        continue;
      }

      const filePath = path.join(migrationsDirectory, file);
      const sql = await readFile(filePath, "utf8");

      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO app_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");

      logger.info("Applied database migration", { file });
    }

    logger.info("Database migration run completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

runMigrations().catch((error) => {
  logger.error("Database migration run failed", {
    message: error instanceof Error ? error.message : "Unknown error",
  });
  process.exitCode = 1;
});
