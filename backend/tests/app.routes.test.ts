import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import "./test-env";
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
    const response = await fetch(`${baseUrl}/api/v1/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        status: "ok",
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
