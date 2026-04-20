import type { NextFunction, Request, Response } from "express";

import { describe, expect, it, vi } from "vitest";

import { requirePermission } from "../src/shared/http/require_permission";
import { AppError } from "../src/shared/errors/app-error";

const createNext = () => vi.fn<NextFunction>((_error?: unknown) => undefined);

describe("requirePermission", () => {
  it("allows requests when the authenticated user has the required permission", () => {
    const middleware = requirePermission("inventory.view");
    const next = createNext();
    const request = {
      authenticatedUser: {
        permissions: ["inventory.view"],
      },
    } as Request;

    middleware(request, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]).toEqual([]);
  });

  it("blocks requests when the authenticated user lacks the required permission", () => {
    const middleware = requirePermission("inventory.view");
    const next = createNext();
    const request = {
      authenticatedUser: {
        permissions: ["billing.view"],
      },
    } as Request;

    middleware(request, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AppError);

    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("PERMISSION_DENIED");
  });
});
