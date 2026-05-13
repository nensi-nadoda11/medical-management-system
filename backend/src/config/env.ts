import { config } from "dotenv";
import { z } from "zod";

import { resolveBackupStorageDirectory } from "./backup-storage";
import { buildAllowedOrigins } from "./runtime-config";

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

const optionalUrlString = z
  .string()
  .trim()
  .url("APP_BASE_URL must be a valid absolute URL.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    ALLOW_DEGRADED_STARTUP: booleanSchema.default(false),
    DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required."),
    DATABASE_SSL_ALLOW_INVALID_CERTS: booleanSchema.default(false),
    DATABASE_SSL_CA_CERT_PATH: optionalString,
    CORS_ALLOWED_ORIGINS: z
      .string()
      .default("http://localhost:5173,http://localhost:5174"),
    APP_BASE_URL: optionalUrlString,
    BACKUP_STORAGE_DIR: optionalString,
    TRUST_PROXY: booleanSchema.default(false),
    INVITATION_EXPIRY_HOURS: z.coerce.number().int().positive(),
    INVITATION_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive(),
    DEFAULT_PHONE_COUNTRY: z.string().trim().length(2).default("IN"),
    AUTH_COOKIE_NAME: z.string().trim().default("mms_session"),
    AUTH_COOKIE_DOMAIN: optionalString,
    AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    AUTH_COOKIE_SECURE: booleanSchema.optional(),
    AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(24),
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
    WHATSAPP_PROVIDER: z.enum(["console", "twilio"]).default("console"),
    TWILIO_ACCOUNT_SID: optionalString,
    TWILIO_AUTH_TOKEN: optionalString,
    TWILIO_FROM_NUMBER: optionalString,
    TWILIO_WHATSAPP_FROM_NUMBER: optionalString,
    TWILIO_WHATSAPP_ADMIN_LOW_STOCK_TEMPLATE_SID: optionalString,
    TWILIO_WHATSAPP_INVENTORY_ATTENTION_TEMPLATE_SID: optionalString,
    TWILIO_WHATSAPP_SUPPLIER_REORDER_TEMPLATE_SID: optionalString,
    TWILIO_WHATSAPP_SHOP_SENDER_MAP: optionalString,
    ALERT_SYNC_ENABLED: booleanSchema.default(true),
    ALERT_SYNC_INTERVAL_MS: z.coerce.number().int().min(30000).default(28800000),
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

    if (input.WHATSAPP_PROVIDER === "twilio") {
      if (!input.TWILIO_ACCOUNT_SID) {
        ctx.addIssue({
          code: "custom",
          path: ["TWILIO_ACCOUNT_SID"],
          message:
            "TWILIO_ACCOUNT_SID is required when WHATSAPP_PROVIDER is twilio.",
        });
      }

      if (!input.TWILIO_AUTH_TOKEN) {
        ctx.addIssue({
          code: "custom",
          path: ["TWILIO_AUTH_TOKEN"],
          message:
            "TWILIO_AUTH_TOKEN is required when WHATSAPP_PROVIDER is twilio.",
        });
      }

      if (!input.TWILIO_WHATSAPP_FROM_NUMBER) {
        ctx.addIssue({
          code: "custom",
          path: ["TWILIO_WHATSAPP_FROM_NUMBER"],
          message:
            "TWILIO_WHATSAPP_FROM_NUMBER is required when WHATSAPP_PROVIDER is twilio.",
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

    if (input.NODE_ENV === "production" && !input.APP_BASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_BASE_URL"],
        message:
          "APP_BASE_URL is required in production to generate invitation links.",
      });
    }

    if (input.NODE_ENV === "production" && input.DATABASE_SSL_ALLOW_INVALID_CERTS) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_SSL_ALLOW_INVALID_CERTS"],
        message:
          "DATABASE_SSL_ALLOW_INVALID_CERTS cannot be true in production. Provide a trusted certificate instead.",
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

const parseWhatsappShopSenderMap = (value?: string) => {
  if (!value) {
    return {} as Record<string, string>;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(
      `Invalid environment configuration: TWILIO_WHATSAPP_SHOP_SENDER_MAP must be valid JSON. ${message}`,
    );
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(
      "Invalid environment configuration: TWILIO_WHATSAPP_SHOP_SENDER_MAP must be a JSON object keyed by shop id.",
    );
  }

  const senderMapEntries = Object.entries(parsed).map(([shopId, sender]) => {
    if (typeof sender !== "string" || !sender.trim()) {
      throw new Error(
        `Invalid environment configuration: TWILIO_WHATSAPP_SHOP_SENDER_MAP value for ${shopId} must be a non-empty string.`,
      );
    }

    return [shopId, sender.trim()] as const;
  });

  return Object.fromEntries(senderMapEntries);
};

const allowedOrigins = buildAllowedOrigins({
  nodeEnv: parsedEnv.data.NODE_ENV,
  corsAllowedOrigins: parsedEnv.data.CORS_ALLOWED_ORIGINS,
});

const whatsappShopSenderMap = parseWhatsappShopSenderMap(
  parsedEnv.data.TWILIO_WHATSAPP_SHOP_SENDER_MAP,
);

const backupStorageDirectory = resolveBackupStorageDirectory({
  configuredPath: parsedEnv.data.BACKUP_STORAGE_DIR,
});

export const env = {
  ...parsedEnv.data,
  AUTH_COOKIE_SECURE:
    parsedEnv.data.AUTH_COOKIE_SECURE ??
    parsedEnv.data.NODE_ENV === "production",
  DEFAULT_PHONE_COUNTRY: parsedEnv.data.DEFAULT_PHONE_COUNTRY.toUpperCase(),
  allowedOrigins,
  backupStorageDirectory,
  whatsappShopSenderMap,
} as const;
