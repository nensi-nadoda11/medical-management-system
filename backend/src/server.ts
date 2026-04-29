import { app } from "./app";
import { env } from "./config/env";
import { pool } from "./db/client";
import { AlertsScheduler } from "./modules/alerts/alerts.scheduler";
import { emailService } from "./modules/notifications/email/email.service";
import { logger } from "./shared/logger";

const alertsScheduler = new AlertsScheduler();

const server = app.listen(env.PORT, async () => {
  logger.info("Backend server started", {
    port: env.PORT,
    environment: env.NODE_ENV,
  });

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
