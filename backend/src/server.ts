import { app } from "./app";
import { env } from "./config/env";
import {
  databaseConnectionSummary,
  pool,
  verifyDatabaseConnection,
} from "./db/client";
import { AlertsScheduler } from "./modules/alerts/alerts.scheduler";
import { emailService } from "./modules/notifications/email/email.service";
import {
  getDatabaseConnectivityErrorCode,
  isDatabaseConnectivityError,
} from "./shared/db/connectivity";
import { logger } from "./shared/logger";

const alertsScheduler = new AlertsScheduler();

const server = app.listen(env.PORT, async () => {
  logger.info("Backend server started", {
    port: env.PORT,
    environment: env.NODE_ENV,
  });

  try {
    await verifyDatabaseConnection();
    logger.info("Database connection verified", {
      host: databaseConnectionSummary.host,
      mode: databaseConnectionSummary.mode,
    });
  } catch (error) {
    logger.error("Database connection verification failed", {
      code: getDatabaseConnectivityErrorCode(error),
      host: databaseConnectionSummary.host,
      mode: databaseConnectionSummary.mode,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    if (
      isDatabaseConnectivityError(error) &&
      databaseConnectionSummary.provider === "supabase" &&
      databaseConnectionSummary.mode === "direct"
    ) {
      logger.warn(
        "Supabase direct database URL detected. This route is typically IPv6-only. On IPv4-only or unstable IPv6 networks, replace DATABASE_URL with the Supavisor session pooler connection string from the Supabase dashboard.",
        {
          host: databaseConnectionSummary.host,
        },
      );
    }
  }

  try {
    await emailService.verifyConnection();
    logger.info("Email provider verified successfully");
  } catch (error) {
    logger.error("Email provider verification failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  alertsScheduler.start();
});

const shutdown = async (signal: string) => {
  logger.info("Received shutdown signal", { signal });
  alertsScheduler.stop();
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
