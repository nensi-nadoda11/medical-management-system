import { createHmac, randomBytes } from "crypto";

import { env } from "../../config/env";

export const generateSessionToken = () => randomBytes(48).toString("base64url");

export const hashSessionToken = (token: string) =>
  createHmac("sha256", env.SESSION_TOKEN_SECRET).update(token).digest("hex");
