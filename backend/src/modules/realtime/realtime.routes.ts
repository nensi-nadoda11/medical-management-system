import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware";
import { realtimeService } from "./realtime.service";

const router = Router();

router.get("/stock-events", requireAuth, (req, res) => {
  const shopId = (req.authenticatedUser ?? req.authSession!.user).shopId;
  const branchId = req.authBranch?.id ?? null;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const unsubscribe = realtimeService.subscribe({
    shopId,
    response: res,
  });
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(": keep-alive\n\n");
    }
  }, 15_000);

  realtimeService.sendEvent(res, {
    type: "connected",
    shopId,
    branchId,
    reason: "subscribed",
    metadata: {
      branchId,
      userId: (req.authenticatedUser ?? req.authSession!.user).id,
    },
  });

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    if (!res.writableEnded) {
      res.end();
    }
  });
});

export const realtimeRoutes = router;
