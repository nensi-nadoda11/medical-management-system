const DEFAULT_LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
] as const;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const isLocalOrigin = (origin: string) => {
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
};

export const buildAllowedOrigins = (input: {
  nodeEnv: "development" | "test" | "production";
  corsAllowedOrigins: string;
}) =>
  Array.from(
    new Set([
      ...input.corsAllowedOrigins
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      ...(input.nodeEnv === "production" ? [] : DEFAULT_LOCAL_ORIGINS),
    ]),
  );

export const resolveAppBaseUrl = (input: {
  nodeEnv: "development" | "test" | "production";
  appBaseUrl: string | undefined;
  allowedOrigins: string[];
}) => {
  if (input.appBaseUrl) {
    return input.appBaseUrl;
  }

  if (input.nodeEnv === "production") {
    throw new Error(
      "APP_BASE_URL is required in production to generate invitation links.",
    );
  }

  return (
    input.allowedOrigins.find((origin) => !isLocalOrigin(origin)) ??
    input.allowedOrigins[0] ??
    DEFAULT_LOCAL_ORIGINS[0]
  );
};
