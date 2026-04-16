import rateLimit from "express-rate-limit";

const createAuthRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
}) =>
  rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: options.message,
        },
      });
    },
  });

export const registrationRateLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many registration attempts. Please wait a few minutes before trying again.",
});

export const loginRateLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please wait a few minutes before trying again.",
});

export const otpVerificationRateLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many OTP verification attempts. Please wait a few minutes before trying again.",
});

export const otpResendRateLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: "Too many OTP resend requests. Please wait before requesting another code.",
});
