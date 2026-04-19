import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error";
import type { PermissionKey } from "../../modules/admin-settings/admin-settings.permissions";

export const requirePermission =
  (permission: PermissionKey) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const authenticatedUser = req.authenticatedUser ?? req.authSession?.user;

    if (!authenticatedUser) {
      return next(
        new AppError({
          statusCode: 401,
          code: "AUTH_REQUIRED",
          message: "Authentication required.",
        }),
      );
    }

    if (!authenticatedUser.permissions?.includes(permission)) {
      return next(
        new AppError({
          statusCode: 403,
          code: "PERMISSION_DENIED",
          message: "You do not have permission to perform this action.",
        }),
      );
    }

    return next();
  };
