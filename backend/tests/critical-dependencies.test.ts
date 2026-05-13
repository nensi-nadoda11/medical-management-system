import { describe, expect, it, vi } from "vitest";

import "./test-env";

const mocks = vi.hoisted(() => ({
  verifyDatabaseConnection: vi.fn(),
  verifyEmailConnection: vi.fn(),
}));

vi.mock("../src/db/client", () => ({
  verifyDatabaseConnection: mocks.verifyDatabaseConnection,
}));

vi.mock("../src/modules/notifications/email/email.service", () => ({
  emailService: {
    verifyConnection: mocks.verifyEmailConnection,
  },
}));

import {
  checkCriticalDependencies,
  hasStartupBlockingDependencyFailures,
} from "../src/shared/runtime/critical-dependencies";

describe("critical dependency checks", () => {
  it("returns ok when database and email checks pass", async () => {
    mocks.verifyDatabaseConnection.mockResolvedValueOnce(undefined);
    mocks.verifyEmailConnection.mockResolvedValueOnce(undefined);

    await expect(checkCriticalDependencies()).resolves.toEqual({
      status: "ok",
      dependencies: [
        {
          name: "database",
          status: "ok",
          startupBlocking: true,
        },
        {
          name: "email",
          status: "ok",
          startupBlocking: false,
        },
      ],
    });
  });

  it("returns error details when a critical dependency fails", async () => {
    const databaseError = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });

    mocks.verifyDatabaseConnection.mockRejectedValueOnce(databaseError);
    mocks.verifyEmailConnection.mockResolvedValueOnce(undefined);

    await expect(checkCriticalDependencies()).resolves.toEqual({
      status: "error",
      dependencies: [
        {
          name: "database",
          status: "error",
          startupBlocking: true,
          code: "ECONNREFUSED",
          message: "connect ECONNREFUSED",
          connectivityError: true,
        },
        {
          name: "email",
          status: "ok",
          startupBlocking: false,
        },
      ],
    });
  });

  it("returns degraded when only a non-blocking dependency fails", async () => {
    mocks.verifyDatabaseConnection.mockResolvedValueOnce(undefined);
    mocks.verifyEmailConnection.mockRejectedValueOnce(
      new Error("SMTP unavailable"),
    );

    await expect(checkCriticalDependencies()).resolves.toEqual({
      status: "degraded",
      dependencies: [
        {
          name: "database",
          status: "ok",
          startupBlocking: true,
        },
        {
          name: "email",
          status: "error",
          startupBlocking: false,
          code: "EMAIL_CHECK_FAILED",
          message: "SMTP unavailable",
        },
      ],
    });
  });

  it("treats only database failures as startup blocking", () => {
    expect(
      hasStartupBlockingDependencyFailures({
        status: "error",
        dependencies: [
          {
            name: "email",
            status: "error",
            startupBlocking: false,
            code: "EMAIL_CHECK_FAILED",
            message: "SMTP unavailable",
          },
        ],
      }),
    ).toBe(false);

    expect(
      hasStartupBlockingDependencyFailures({
        status: "error",
        dependencies: [
          {
            name: "database",
            status: "error",
            startupBlocking: true,
            code: "ECONNREFUSED",
            message: "connect ECONNREFUSED",
          },
        ],
      }),
    ).toBe(true);
  });
});
