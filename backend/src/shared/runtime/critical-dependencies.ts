import { verifyDatabaseConnection } from "../../db/client";
import { emailService } from "../../modules/notifications/email/email.service";
import {
  getDatabaseConnectivityErrorCode,
  isDatabaseConnectivityError,
} from "../db/connectivity";

export type CriticalDependencyName = "database" | "email";

export type CriticalDependencyCheck = {
  name: CriticalDependencyName;
  status: "ok" | "error";
  startupBlocking: boolean;
  code?: string;
  message?: string;
  connectivityError?: boolean;
};

export type CriticalDependencySummary = {
  status: "ok" | "degraded" | "error";
  dependencies: CriticalDependencyCheck[];
};

const DATABASE_CHECK_TIMEOUT_MS = 12_000;
const EMAIL_CHECK_TIMEOUT_MS = 8_000;
const CRITICAL_DEPENDENCY_CACHE_TTL_MS = 15_000;

const dependencyMetadata: Record<
  CriticalDependencyName,
  {
    startupBlocking: boolean;
  }
> = {
  database: {
    startupBlocking: true,
  },
  email: {
    startupBlocking: false,
  },
};

const buildSuccessfulCheck = (
  name: CriticalDependencyName,
): CriticalDependencyCheck => ({
  name,
  status: "ok",
  startupBlocking: dependencyMetadata[name].startupBlocking,
});

const buildFailedCheck = (
  name: CriticalDependencyName,
  error: unknown,
): CriticalDependencyCheck => {
  const resolvedMessage =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : name === "database"
        ? "Unknown database error"
        : "Unknown email error";

  if (name === "database") {
    return {
      name,
      status: "error",
      startupBlocking: dependencyMetadata[name].startupBlocking,
      code: getDatabaseConnectivityErrorCode(error) ?? "DATABASE_CHECK_FAILED",
      message: resolvedMessage,
      connectivityError: isDatabaseConnectivityError(error),
    };
  }

  return {
    name,
    status: "error",
    startupBlocking: dependencyMetadata[name].startupBlocking,
    code: "EMAIL_CHECK_FAILED",
    message: resolvedMessage,
  };
};

const withTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) => {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

let cachedSummary: CriticalDependencySummary | null = null;
let cacheExpiresAt = 0;
let pendingCachedCheck: Promise<CriticalDependencySummary> | null = null;

const buildSummaryStatus = (dependencies: CriticalDependencyCheck[]) => {
  const hasStartupBlockingFailure = dependencies.some(
    (dependency) => dependency.startupBlocking && dependency.status === "error",
  );

  if (hasStartupBlockingFailure) {
    return "error" as const;
  }

  const hasAnyFailure = dependencies.some(
    (dependency) => dependency.status === "error",
  );

  return hasAnyFailure ? ("degraded" as const) : ("ok" as const);
};

const runCriticalDependencyCheck = async (): Promise<CriticalDependencySummary> => {
  const [databaseResult, emailResult] = await Promise.allSettled([
    withTimeout(
      verifyDatabaseConnection(),
      DATABASE_CHECK_TIMEOUT_MS,
      `Database readiness check timed out after ${DATABASE_CHECK_TIMEOUT_MS}ms.`,
    ),
    withTimeout(
      emailService.verifyConnection(),
      EMAIL_CHECK_TIMEOUT_MS,
      `Email readiness check timed out after ${EMAIL_CHECK_TIMEOUT_MS}ms.`,
    ),
  ]);

  const dependencies: CriticalDependencyCheck[] = [
    databaseResult.status === "fulfilled"
      ? buildSuccessfulCheck("database")
      : buildFailedCheck("database", databaseResult.reason),
    emailResult.status === "fulfilled"
      ? buildSuccessfulCheck("email")
      : buildFailedCheck("email", emailResult.reason),
  ];

  return {
    status: buildSummaryStatus(dependencies),
    dependencies,
  };
};

export const checkCriticalDependencies =
  async (
    options?: {
      useCache?: boolean;
    },
  ): Promise<CriticalDependencySummary> => {
    if (!options?.useCache) {
      return runCriticalDependencyCheck();
    }

    const now = Date.now();
    if (cachedSummary && cacheExpiresAt > now) {
      return cachedSummary;
    }

    if (!pendingCachedCheck) {
      pendingCachedCheck = runCriticalDependencyCheck()
        .then((summary) => {
          cachedSummary = summary;
          cacheExpiresAt = Date.now() + CRITICAL_DEPENDENCY_CACHE_TTL_MS;
          return summary;
        })
        .finally(() => {
          pendingCachedCheck = null;
        });
    }

    return pendingCachedCheck;
  };

export const hasStartupBlockingDependencyFailures = (
  summary: CriticalDependencySummary,
) =>
  summary.dependencies.some(
    (dependency) => dependency.startupBlocking && dependency.status === "error",
  );
