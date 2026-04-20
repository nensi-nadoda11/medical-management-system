const DEFAULT_API_BASE_URL = "/api/v1";
const DEFAULT_DEV_BACKEND_URL = "http://localhost:4000";
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

type ApiEnvironment = {
  VITE_API_BASE_URL?: string;
  VITE_BACKEND_URL?: string;
};

const getTrimmedEnvValue = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const isAbsoluteUrl = (value: string) => ABSOLUTE_URL_PATTERN.test(value);

export const resolveApiBaseUrl = (env: ApiEnvironment) =>
  getTrimmedEnvValue(env.VITE_API_BASE_URL) ?? DEFAULT_API_BASE_URL;

export const resolveBackendProxyTarget = (env: ApiEnvironment) => {
  const backendUrl = getTrimmedEnvValue(env.VITE_BACKEND_URL);

  if (backendUrl) {
    return backendUrl;
  }

  const apiBaseUrl = getTrimmedEnvValue(env.VITE_API_BASE_URL);

  if (apiBaseUrl && isAbsoluteUrl(apiBaseUrl)) {
    return new URL(apiBaseUrl).origin;
  }

  return DEFAULT_DEV_BACKEND_URL;
};
