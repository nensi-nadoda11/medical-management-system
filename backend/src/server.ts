import { app } from "./app";
import { env } from "./config/env";
import {
  databaseConnectionSummary,
  pool,
  verifyDatabaseConnection,
} from "./db/client";
import { AlertsScheduler } from "./modules/alerts/alerts.scheduler";
import { isDatabaseConnectivityError } from "./shared/db/connectivity";
import { logger } from "./shared/logger";
import {
  checkCriticalDependencies,
  hasStartupBlockingDependencyFailures,
} from "./shared/runtime/critical-dependencies";

const alertsScheduler = new AlertsScheduler();
let server: ReturnType<typeof app.listen> | null = null;
let alertsRecoveryTimer: NodeJS.Timeout | null = null;
const ALERTS_RECOVERY_INTERVAL_MS = 30_000;

const stopAlertsRecoveryMonitor = () => {
  if (!alertsRecoveryTimer) {
    return;
  }

  clearInterval(alertsRecoveryTimer);
  alertsRecoveryTimer = null;
};

const startAlertsRecoveryMonitor = () => {
  if (alertsRecoveryTimer || !env.ALERT_SYNC_ENABLED) {
    return;
  }

  const attemptRecovery = async () => {
    try {
      await verifyDatabaseConnection();
      stopAlertsRecoveryMonitor();
      logger.info("Database connectivity recovered; starting alerts scheduler");
      alertsScheduler.start();
    } catch (error) {
      if (!isDatabaseConnectivityError(error)) {
        logger.warn("Alerts scheduler recovery check failed unexpectedly", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  };

  alertsRecoveryTimer = setInterval(() => {
    void attemptRecovery();
  }, ALERTS_RECOVERY_INTERVAL_MS);

  void attemptRecovery();
};

const bootstrap = async () => {
  const readiness = await checkCriticalDependencies();

  for (const dependency of readiness.dependencies) {
    if (dependency.status === "ok") {
      logger.info("Critical dependency verified", {
        dependency: dependency.name,
      });
      continue;
    }

    const log = dependency.startupBlocking ? logger.error : logger.warn;

    log("Critical dependency verification failed", {
      dependency: dependency.name,
      code: dependency.code,
      message: dependency.message,
      startupBlocking: dependency.startupBlocking,
      ...(dependency.name === "database"
        ? {
            host: databaseConnectionSummary.host,
            mode: databaseConnectionSummary.mode,
          }
        : {}),
    });
  }

  const databaseFailure = readiness.dependencies.find(
    (dependency) =>
      dependency.name === "database" && dependency.status === "error",
  );
  const databaseReady = !databaseFailure;

  if (
    databaseFailure?.connectivityError &&
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

  if (hasStartupBlockingDependencyFailures(readiness)) {
    if (env.ALLOW_DEGRADED_STARTUP) {
      logger.warn("Starting backend in degraded mode", {
        reason:
          "ALLOW_DEGRADED_STARTUP is enabled while a startup-blocking dependency is unavailable.",
      });
    } else {
      throw new Error("Critical dependency verification failed.");
    }
  }

  server = app.listen(env.PORT, () => {
    logger.info("Backend server started", {
      port: env.PORT,
      environment: env.NODE_ENV,
      degradedStartup: hasStartupBlockingDependencyFailures(readiness),
    });

    if (databaseReady) {
      alertsScheduler.start();
      return;
    }

    logger.warn("Alerts scheduler not started", {
      reason: "Database dependency is unavailable during degraded startup.",
    });
    startAlertsRecoveryMonitor();
  });
};

const shutdown = async (signal: string) => {
  logger.info("Received shutdown signal", { signal });
  stopAlertsRecoveryMonitor();
  alertsScheduler.stop();

  if (!server) {
    await pool.end();
    logger.info("Backend server stopped gracefully");
    process.exit(0);
    return;
  }

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

void bootstrap().catch(async (error) => {
  logger.error("Backend server startup failed", {
    message: error instanceof Error ? error.message : "Unknown error",
  });

  try {
    await pool.end();
  } catch (poolError) {
    logger.error("Failed to close database pool after startup failure", {
      message:
        poolError instanceof Error ? poolError.message : "Unknown error",
    });
  }

  process.exit(1);
});
