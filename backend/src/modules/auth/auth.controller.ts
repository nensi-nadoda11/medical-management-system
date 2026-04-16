import type { Request, Response } from "express";

import { env } from "../../config/env";
import { asyncHandler } from "../../shared/http/async-handler";
import { buildAuthCookieOptions } from "./auth.cookies";
import { authService } from "./auth.service";

const clearCookieOptions = {
  ...buildAuthCookieOptions(),
  expires: new Date(0),
  maxAge: 0,
};

export const authController = {
  registerAdmin: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.registerAdmin(req.body);

    res.status(201).json({
      success: true,
      data: result,
    });
  }),

  verifyRegistration: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.verifyRegistration(req.body);

    res.status(200).json({
      success: true,
      data: result,
    });
  }),

  resendRegistrationOtp: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resendRegistrationOtp(req.body);

    res.status(200).json({
      success: true,
      data: result,
    });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const requestContext: { ipAddress?: string; userAgent?: string } = {};

    if (req.ip) {
      requestContext.ipAddress = req.ip;
    }

    const userAgent = req.get("user-agent");
    if (userAgent) {
      requestContext.userAgent = userAgent;
    }

    const result = await authService.login(req.body, requestContext);

    res.cookie(env.AUTH_COOKIE_NAME, result.sessionToken, {
      ...buildAuthCookieOptions(),
      maxAge: env.AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      data: {
        message: result.message,
        sessionExpiresAt: result.sessionExpiresAt,
        user: result.user,
        shop: result.shop,
      },
    });
  }),

  getSession: asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: req.authSession,
    });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const sessionToken = req.cookies?.[env.AUTH_COOKIE_NAME];

    if (sessionToken && typeof sessionToken === "string") {
      await authService.logout(sessionToken);
    }

    res.clearCookie(env.AUTH_COOKIE_NAME, clearCookieOptions);
    res.status(200).json({
      success: true,
      data: {
        message: "Logged out successfully.",
      },
    });
  }),
};
