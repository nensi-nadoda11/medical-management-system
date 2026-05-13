import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import "./test-env";

const mocks = vi.hoisted(() => ({
  checkCriticalDependencies: vi.fn(),
}));

vi.mock("../src/shared/runtime/critical-dependencies", () => ({
  checkCriticalDependencies: mocks.checkCriticalDependencies,
}));

import { app } from "../src/app";

let server: ReturnType<typeof app.listen>;
let baseUrl = "";

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");

  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address() as AddressInfo | null;

  if (!address) {
    throw new Error("Test server did not expose a listening address.");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

describe("application routes", () => {
  it("returns a healthy status payload", async () => {
    mocks.checkCriticalDependencies.mockResolvedValueOnce({
      status: "ok",
      dependencies: [
        { name: "database", status: "ok" },
        { name: "email", status: "ok" },
      ],
    });

    const response = await fetch(`${baseUrl}/api/v1/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        status: "ok",
        checks: {
          database: {
            status: "ok",
          },
          email: {
            status: "ok",
          },
        },
      },
    });
  });

  it("returns a service unavailable payload when a critical dependency is down", async () => {
    mocks.checkCriticalDependencies.mockResolvedValueOnce({
      status: "error",
      dependencies: [
        {
          name: "database",
          status: "error",
          startupBlocking: true,
          code: "ECONNREFUSED",
        },
        {
          name: "email",
          status: "ok",
          startupBlocking: false,
        },
      ],
    });

    const response = await fetch(`${baseUrl}/api/v1/health`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
      },
      data: {
        status: "error",
        checks: {
          database: {
            status: "error",
            code: "ECONNREFUSED",
          },
          email: {
            status: "ok",
          },
        },
      },
    });
  });

  it("returns a degraded but successful payload when only email is unavailable", async () => {
    mocks.checkCriticalDependencies.mockResolvedValueOnce({
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
        },
      ],
    });

    const response = await fetch(`${baseUrl}/api/v1/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        status: "degraded",
        checks: {
          database: {
            status: "ok",
          },
          email: {
            status: "error",
            code: "EMAIL_CHECK_FAILED",
          },
        },
      },
    });
  });

  it("returns an unauthorized error for auth session without a cookie", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/session`);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "UNAUTHORIZED",
      },
    });
  });
});
