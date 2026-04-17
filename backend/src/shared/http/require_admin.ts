import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";

export const requireAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
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

  if (authenticatedUser.role !== "admin") {
    return next(
      new AppError({
        statusCode: 403,
        code: "ADMIN_REQUIRED",
        message: "You do not have permission to perform this action.",
      }),
    );
  }

  return next();
};
