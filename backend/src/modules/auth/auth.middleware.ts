import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { AppError } from "../../shared/errors/app-error";
import { BranchesService } from "../branches/branches.service";
import { authService } from "./auth.service";

const branchesService = new BranchesService();

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const sessionToken = req.cookies?.[env.AUTH_COOKIE_NAME];

    if (!sessionToken || typeof sessionToken !== "string") {
      throw new AppError({
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "Authentication is required to access this resource.",
      });
    }

    const session = await authService.getSessionContext(sessionToken);

    if (!session) {
      throw new AppError({
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "Your session is invalid or has expired.",
      });
    }

    req.authSession = session;
    req.authenticatedUser = session.user;
    const requestedBranchId = req.header("x-branch-id");
    const branchAccess = await branchesService.resolveRequestBranchContext({
      shopId: session.user.shopId,
      userId: session.user.id,
      role: session.user.role,
      ...(typeof requestedBranchId === "string" && requestedBranchId.length
        ? { requestedBranchId }
        : {}),
    });
    req.authBranchAccess = branchAccess;
    req.authBranch = branchAccess.currentBranch;
    next();
  } catch (error) {
    next(error);
  }
};
