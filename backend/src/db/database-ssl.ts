import { readFileSync } from "fs";

import type { ConnectionOptions } from "tls";

export const buildDatabaseSslConfig = (input: {
  sslRequired: boolean;
  allowInvalidCertificates: boolean;
  caCertPath?: string | undefined;
}): ConnectionOptions | undefined => {
  if (!input.sslRequired) {
    return undefined;
  }

  if (input.allowInvalidCertificates) {
    return {
      rejectUnauthorized: false,
    };
  }

  return {
    rejectUnauthorized: true,
    ...(input.caCertPath
      ? {
          ca: readFileSync(input.caCertPath, "utf8"),
        }
      : {}),
  };
};
