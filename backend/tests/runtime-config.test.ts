import { describe, expect, it } from "vitest";

import {
  buildAllowedOrigins,
  resolveAppBaseUrl,
} from "../src/config/runtime-config";

describe("runtime config helpers", () => {
  it("adds local dev origins outside production", () => {
    expect(
      buildAllowedOrigins({
        nodeEnv: "development",
        corsAllowedOrigins: "https://example.com",
      }),
    ).toEqual([
      "https://example.com",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
    ]);
  });

  it("does not auto-append local origins in production", () => {
    expect(
      buildAllowedOrigins({
        nodeEnv: "production",
        corsAllowedOrigins: "https://app.medical-store.in",
      }),
    ).toEqual(["https://app.medical-store.in"]);
  });

  it("uses the configured app base url when present", () => {
    expect(
      resolveAppBaseUrl({
        nodeEnv: "production",
        appBaseUrl: "https://app.medical-store.in",
        allowedOrigins: ["https://api.medical-store.in"],
      }),
    ).toBe("https://app.medical-store.in");
  });

  it("throws in production when app base url is missing", () => {
    expect(() =>
      resolveAppBaseUrl({
        nodeEnv: "production",
        allowedOrigins: ["https://api.medical-store.in"],
      }),
    ).toThrow("APP_BASE_URL is required in production");
  });
});
