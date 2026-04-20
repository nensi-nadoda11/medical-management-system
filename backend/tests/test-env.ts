process.env.NODE_ENV = "test";
process.env.PORT = process.env.PORT ?? "4000";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/medical_management_test";
process.env.CORS_ALLOWED_ORIGINS =
  process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:5173";
process.env.TRUST_PROXY = process.env.TRUST_PROXY ?? "false";
process.env.INVITATION_EXPIRY_HOURS =
  process.env.INVITATION_EXPIRY_HOURS ?? "12";
process.env.INVITATION_RESEND_COOLDOWN_SECONDS =
  process.env.INVITATION_RESEND_COOLDOWN_SECONDS ?? "60";
process.env.DEFAULT_PHONE_COUNTRY = process.env.DEFAULT_PHONE_COUNTRY ?? "IN";
process.env.AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "mms_session";
process.env.AUTH_COOKIE_SAME_SITE =
  process.env.AUTH_COOKIE_SAME_SITE ?? "lax";
process.env.AUTH_COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE ?? "false";
process.env.AUTH_SESSION_TTL_HOURS =
  process.env.AUTH_SESSION_TTL_HOURS ?? "12";
process.env.SESSION_TOKEN_SECRET =
  process.env.SESSION_TOKEN_SECRET ??
  "01234567890123456789012345678901";
process.env.OTP_EXPIRY_MINUTES = process.env.OTP_EXPIRY_MINUTES ?? "60";
process.env.OTP_RESEND_COOLDOWN_SECONDS =
  process.env.OTP_RESEND_COOLDOWN_SECONDS ?? "60";
process.env.OTP_HASH_SECRET =
  process.env.OTP_HASH_SECRET ?? "abcdefghijklmnopqrstuvwxyz123456";
process.env.EMAIL_PROVIDER = "console";
process.env.EMAIL_FROM_NAME =
  process.env.EMAIL_FROM_NAME ?? "Medical Management System";
process.env.EMAIL_FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS ?? "no-reply@example.com";
process.env.SMS_PROVIDER = "console";
