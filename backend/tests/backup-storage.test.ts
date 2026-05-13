import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

import { resolveBackupStorageDirectory } from "../src/config/backup-storage";

describe("backup storage directory resolution", () => {
  it("defaults to a backup folder outside the project workspace", () => {
    const projectRoot = path.resolve("E:/medical_management_system");
    const resolved = resolveBackupStorageDirectory({
      configuredPath: undefined,
      projectRoot,
    });

    expect(resolved).toBe(
      path.resolve(os.homedir(), ".medical-management-system", "backups"),
    );
    const relativePath = path.relative(projectRoot, resolved);
    expect(
      relativePath.startsWith("..") || path.isAbsolute(relativePath),
    ).toBe(true);
  });

  it("allows a configured directory outside the workspace", () => {
    const resolved = resolveBackupStorageDirectory({
      projectRoot: "E:/medical_management_system",
      configuredPath: "E:/medical-management-backups",
    });

    expect(resolved).toBe(path.resolve("E:/medical-management-backups"));
  });

  it("rejects a configured directory inside the workspace", () => {
    expect(() =>
      resolveBackupStorageDirectory({
        projectRoot: "E:/medical_management_system",
        configuredPath: "E:/medical_management_system/backend/storage/backups",
      }),
    ).toThrow("BACKUP_STORAGE_DIR must point outside the application workspace");
  });
});
