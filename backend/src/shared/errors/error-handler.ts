import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../../config/env";
import { logger } from "../logger";
import { AppError, isAppError } from "./app-error";

const formatZodError = (error: ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction) => {
  next(
    new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
    }),
  );
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof ZodError) {
    logger.warn("Validation error", {
      issues: formatZodError(error),
    });

    return res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Please review the submitted information and try again.",
        details: formatZodError(error),
      },
    });
  }

  if (isAppError(error)) {
    logger.warn("Application error", {
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
      details: error.details,
      stack: error.stack,
    });

    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.expose
          ? error.message
          : "Something went wrong. Please try again later.",
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    return res.status(409).json({
      success: false,
      error: {
        code: "RESOURCE_CONFLICT",
        message: "A record with the provided details already exists.",
      },
    });
  }

  logger.error("Unhandled application error", {
    message: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
  });

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong. Please try again later.",
    },
  });
};
