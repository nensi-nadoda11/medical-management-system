import { describe, expect, it } from "vitest";

import {
  resolveApiBaseUrl,
  resolveBackendProxyTarget,
} from "../src/lib/api-config";

describe("API configuration", () => {
  it("prefers an explicit API base URL when provided", () => {
    expect(
      resolveApiBaseUrl({
        VITE_API_BASE_URL: "https://api.example.com/api/v1",
      }),
    ).toBe("https://api.example.com/api/v1");
  });

  it("derives the dev proxy target from an absolute API base URL", () => {
    expect(
      resolveBackendProxyTarget({
        VITE_API_BASE_URL: "http://localhost:4001/api/v1",
      }),
    ).toBe("http://localhost:4001");
  });

  it("falls back to the local backend origin when no env override is set", () => {
    expect(resolveBackendProxyTarget({})).toBe("http://localhost:4000");
  });
});
