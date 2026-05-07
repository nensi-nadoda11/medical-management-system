import { describe, expect, it } from "vitest";

import {
  getDatabaseConnectivityErrorCode,
  isDatabaseConnectivityError,
  summarizeDatabaseConnection,
} from "../src/shared/db/connectivity";

describe("database connectivity helpers", () => {
  it("detects direct connectivity errors", () => {
    const error = Object.assign(new Error("getaddrinfo ENOTFOUND host"), {
      code: "ENOTFOUND",
    });

    expect(getDatabaseConnectivityErrorCode(error)).toBe("ENOTFOUND");
    expect(isDatabaseConnectivityError(error)).toBe(true);
  });

  it("detects nested connectivity errors", () => {
    const error = new Error("Failed query");
    (
      error as Error & {
        cause?: unknown;
      }
    ).cause = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });

    expect(getDatabaseConnectivityErrorCode(error)).toBe("ECONNREFUSED");
    expect(isDatabaseConnectivityError(error)).toBe(true);
  });

  it("identifies supabase direct connection details", () => {
    expect(
      summarizeDatabaseConnection(
        "postgresql://postgres:password@db.exampleproject.supabase.co:5432/postgres",
      ),
    ).toMatchObject({
      provider: "supabase",
      mode: "direct",
      sslRequired: true,
    });
  });

  it("identifies supabase session pooler details", () => {
    expect(
      summarizeDatabaseConnection(
        "postgresql://postgres.exampleproject:password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
      ),
    ).toMatchObject({
      provider: "supabase",
      mode: "session-pooler",
      sslRequired: true,
    });
  });
});
