import type { CookieOptions } from "express";

import { env } from "../../config/env";

export const buildAuthCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.AUTH_COOKIE_SECURE,
  sameSite: env.AUTH_COOKIE_SAME_SITE,
  domain: env.AUTH_COOKIE_DOMAIN,
  path: "/",
});
