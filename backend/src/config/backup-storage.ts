import os from "os";
import path from "path";

const normalizeResolvedPath = (value: string) =>
  path.resolve(value).replace(/[\\\/]+$/, "");

export const resolveBackupStorageDirectory = (input?: {
  configuredPath?: string | undefined;
  projectRoot?: string;
}) => {
  const projectRoot = normalizeResolvedPath(
    input?.projectRoot ?? process.cwd(),
  );
  const configuredPath = input?.configuredPath?.trim();
  const resolvedPath = normalizeResolvedPath(
    configuredPath && configuredPath.length
      ? configuredPath
      : path.join(os.homedir(), ".medical-management-system", "backups"),
  );

  const relativeToProject = path.relative(projectRoot, resolvedPath);
  const isInsideProject =
    relativeToProject.length === 0 ||
    (!relativeToProject.startsWith("..") &&
      !path.isAbsolute(relativeToProject));

  if (isInsideProject) {
    throw new Error(
      "BACKUP_STORAGE_DIR must point outside the application workspace to keep backup files separate from source code.",
    );
  }

  return resolvedPath;
};
