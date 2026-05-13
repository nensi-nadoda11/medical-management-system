type ErrorWithCode = {
  code?: unknown;
  cause?: unknown;
  message?: unknown;
};

export type DatabaseConnectionSummary = {
  host: string | null;
  port: number | null;
  provider: "supabase" | "other";
  mode: "direct" | "session-pooler" | "transaction-pooler" | "other";
  sslRequired: boolean;
};

const DATABASE_CONNECTIVITY_ERROR_CODES = new Set([
  "57P01",
  "57P03",
  "08001",
  "08006",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "EPIPE",
  "ETIMEDOUT",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EACCES",
]);

const LOCAL_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

const getErrorLike = (value: unknown): ErrorWithCode | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as ErrorWithCode;
};

const normalizeErrorCode = (value: unknown) =>
  typeof value === "string" ? value.trim().toUpperCase() : undefined;

const getNestedCause = (value: unknown) => getErrorLike(value)?.cause;

export const getDatabaseConnectivityErrorCode = (
  error: unknown,
): string | undefined => {
  const directCode = normalizeErrorCode(getErrorLike(error)?.code);

  if (directCode) {
    return directCode;
  }

  const nestedCause = getNestedCause(error);

  if (!nestedCause || nestedCause === error) {
    return undefined;
  }

  return getDatabaseConnectivityErrorCode(nestedCause);
};

export const isDatabaseConnectivityError = (error: unknown): boolean => {
  const code = getDatabaseConnectivityErrorCode(error);

  if (code && DATABASE_CONNECTIVITY_ERROR_CODES.has(code)) {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof getErrorLike(error)?.message === "string"
        ? String(getErrorLike(error)?.message).toLowerCase()
        : "";

  return (
    message.includes("getaddrinfo") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("server closed the connection unexpectedly") ||
    message.includes("connect etimedout") ||
    message.includes("connect econnrefused") ||
    message.includes("connect enetunreach") ||
    message.includes("connect ehostunreach") ||
    message.includes("self-signed certificate in certificate chain") ||
    message.includes("unable to verify the first certificate")
  );
};

export const summarizeDatabaseConnection = (
  connectionString: string,
): DatabaseConnectionSummary => {
  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname || null;
    const port = parsed.port ? Number(parsed.port) : null;
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    const provider = host?.includes("supabase.") ? "supabase" : "other";
    const isPoolerHost = host?.endsWith(".pooler.supabase.com") ?? false;
    const isDirectSupabaseHost =
      host?.startsWith("db.") && host?.endsWith(".supabase.co");
    let mode: DatabaseConnectionSummary["mode"] = "other";

    if (provider === "supabase" && isDirectSupabaseHost && port === 5432) {
      mode = "direct";
    } else if (provider === "supabase" && isPoolerHost && port === 5432) {
      mode = "session-pooler";
    } else if (
      provider === "supabase" &&
      ((isPoolerHost && port === 6543) ||
        (isDirectSupabaseHost && port === 6543))
    ) {
      mode = "transaction-pooler";
    }

    const sslRequired =
      sslMode === "require" ||
      sslMode === "verify-ca" ||
      sslMode === "verify-full" ||
      (provider === "supabase" && !LOCAL_DATABASE_HOSTS.has(host ?? ""));

    return {
      host,
      port,
      provider,
      mode,
      sslRequired,
    };
  } catch {
    return {
      host: null,
      port: null,
      provider: "other",
      mode: "other",
      sslRequired: false,
    };
  }
};
