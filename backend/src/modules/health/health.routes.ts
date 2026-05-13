import { Router } from "express";

import { checkCriticalDependencies } from "../../shared/runtime/critical-dependencies";

const router = Router();

router.get("/", async (_req, res) => {
  const readiness = await checkCriticalDependencies({ useCache: true });
  const timestamp = new Date().toISOString();
  const checks = Object.fromEntries(
    readiness.dependencies.map((dependency) => [
      dependency.name,
      {
        status: dependency.status,
        ...(dependency.code ? { code: dependency.code } : {}),
      },
    ]),
  );

  if (readiness.status === "ok" || readiness.status === "degraded") {
    res.status(200).json({
      success: true,
      data: {
        status: readiness.status,
        timestamp,
        checks,
      },
    });
    return;
  }

  res.status(503).json({
    success: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Critical services are not ready.",
    },
    data: {
      status: "error",
      timestamp,
      checks,
    },
  });
});

export const healthRoutes = router;
