import { config } from "dotenv";
import { z } from "zod";

config();

const booleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required."),
    CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
    TRUST_PROXY: booleanSchema.default(false),
    INVITATION_EXPIRY_HOURS: z.coerce.number().int().positive(),
    INVITATION_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive(),
    DEFAULT_PHONE_COUNTRY: z.string().trim().length(2).default("IN"),
    AUTH_COOKIE_NAME: z.string().trim().default("mms_session"),
    AUTH_COOKIE_DOMAIN: optionalString,
    AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    AUTH_COOKIE_SECURE: booleanSchema.optional(),
    AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
    SESSION_TOKEN_SECRET: z
      .string()
      .trim()
      .min(32, "SESSION_TOKEN_SECRET must be at least 32 characters."),
    OTP_EXPIRY_MINUTES: z.coerce.number().int().min(5).max(60).default(60),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(600)
      .default(60),
    OTP_HASH_SECRET: z
      .string()
      .trim()
      .min(32, "OTP_HASH_SECRET must be at least 32 characters."),
    EMAIL_PROVIDER: z
      .enum(["console", "smtp", "nodemailer"])
      .default("console"),
    EMAIL_FROM_NAME: z.string().trim().default("Medical Management System"),
    EMAIL_FROM_ADDRESS: z
      .string()
      .trim()
      .email()
      .default("no-reply@example.com"),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_SECURE: booleanSchema.default(false),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    SMS_PROVIDER: z.enum(["console", "twilio"]).default("console"),
    TWILIO_ACCOUNT_SID: optionalString,
    TWILIO_AUTH_TOKEN: optionalString,
    TWILIO_FROM_NUMBER: optionalString,
  })
  .superRefine((input, ctx) => {
    if (
      input.EMAIL_PROVIDER === "smtp" ||
      input.EMAIL_PROVIDER === "nodemailer"
    ) {
      if (!input.SMTP_HOST) {
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_HOST"],
          message:
            "SMTP_HOST is required when EMAIL_PROVIDER is smtp or nodemailer.",
        });
      }

      if (!input.SMTP_PORT) {
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_PORT"],
          message:
            "SMTP_PORT is required when EMAIL_PROVIDER is smtp or nodemailer.",
        });
      }

      if (!input.SMTP_USER) {
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_USER"],
          message:
            "SMTP_USER is required when EMAIL_PROVIDER is smtp or nodemailer.",
        });
      }

      if (!input.SMTP_PASS) {
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_PASS"],
          message:
            "SMTP_PASS is required when EMAIL_PROVIDER is smtp or nodemailer.",
        });
      }
    }

    if (input.SMS_PROVIDER === "twilio") {
      if (!input.TWILIO_ACCOUNT_SID) {
        ctx.addIssue({
          code: "custom",
          path: ["TWILIO_ACCOUNT_SID"],
          message:
            "TWILIO_ACCOUNT_SID is required when SMS_PROVIDER is twilio.",
        });
      }

      if (!input.TWILIO_AUTH_TOKEN) {
        ctx.addIssue({
          code: "custom",
          path: ["TWILIO_AUTH_TOKEN"],
          message: "TWILIO_AUTH_TOKEN is required when SMS_PROVIDER is twilio.",
        });
      }

      if (!input.TWILIO_FROM_NUMBER) {
        ctx.addIssue({
          code: "custom",
          path: ["TWILIO_FROM_NUMBER"],
          message:
            "TWILIO_FROM_NUMBER is required when SMS_PROVIDER is twilio.",
        });
      }
    }

    if (
      input.AUTH_COOKIE_SAME_SITE === "none" &&
      input.AUTH_COOKIE_SECURE === false
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_COOKIE_SECURE"],
        message:
          "AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE is none.",
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const message = parsedEnv.error.issues
    .map((issue) => issue.message)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${message}`);
}

const allowedOrigins = parsedEnv.data.CORS_ALLOWED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  ...parsedEnv.data,
  AUTH_COOKIE_SECURE:
    parsedEnv.data.AUTH_COOKIE_SECURE ??
    parsedEnv.data.NODE_ENV === "production",
  DEFAULT_PHONE_COUNTRY: parsedEnv.data.DEFAULT_PHONE_COUNTRY.toUpperCase(),
  allowedOrigins,
} as const;
