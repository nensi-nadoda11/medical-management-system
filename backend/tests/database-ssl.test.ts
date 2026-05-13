import { mkdtempSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

import { buildDatabaseSslConfig } from "../src/db/database-ssl";

describe("database ssl config", () => {
  it("returns undefined when ssl is not required", () => {
    expect(
      buildDatabaseSslConfig({
        sslRequired: false,
        allowInvalidCertificates: false,
      }),
    ).toBeUndefined();
  });

  it("enables strict certificate verification by default", () => {
    expect(
      buildDatabaseSslConfig({
        sslRequired: true,
        allowInvalidCertificates: false,
      }),
    ).toEqual({
      rejectUnauthorized: true,
    });
  });

  it("loads a CA certificate when a path is provided", () => {
    const tempDirectory = mkdtempSync(path.join(os.tmpdir(), "mms-db-ca-"));
    const certificatePath = path.join(tempDirectory, "ca.pem");

    writeFileSync(certificatePath, "test-ca-certificate", "utf8");

    expect(
      buildDatabaseSslConfig({
        sslRequired: true,
        allowInvalidCertificates: false,
        caCertPath: certificatePath,
      }),
    ).toEqual({
      rejectUnauthorized: true,
      ca: "test-ca-certificate",
    });
  });

  it("keeps the explicit invalid-cert override available for controlled environments", () => {
    expect(
      buildDatabaseSslConfig({
        sslRequired: true,
        allowInvalidCertificates: true,
      }),
    ).toEqual({
      rejectUnauthorized: false,
    });
  });
});
