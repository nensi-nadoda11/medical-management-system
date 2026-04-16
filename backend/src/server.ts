import { app } from "./app";
import { env } from "./config/env";
import { pool } from "./db/client";
import { logger } from "./shared/logger";

const server = app.listen(env.PORT, () => {
  logger.info("Backend server started", {
    port: env.PORT,
    environment: env.NODE_ENV,
  });
});

const shutdown = async (signal: string) => {
  logger.info("Received shutdown signal", { signal });
  server.close(async () => {
    await pool.end();
    logger.info("Backend server stopped gracefully");
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
