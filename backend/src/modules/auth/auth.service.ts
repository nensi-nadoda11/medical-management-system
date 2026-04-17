import { randomUUID } from "crypto";

import { db } from "../../db/client";
import { env } from "../../config/env";
import { emailService } from "../notifications/email/email.service";
import { smsService } from "../notifications/sms/sms.service";
import { AppError } from "../../shared/errors/app-error";
import { logger } from "../../shared/logger";
import {
  generateNumericOtp,
  hashOtpCode,
  verifyOtpCodeHash,
} from "../../shared/security/otp";
import { hashPassword, verifyPassword } from "../../shared/security/password";
import {
  generateSessionToken,
  hashSessionToken,
} from "../../shared/security/session";
import { toSlug } from "../../shared/utils/strings";
import {
  LOGIN_LOCK_DURATION_MINUTES,
  MAX_LOGIN_ATTEMPTS,
  MAX_OTP_ATTEMPTS,
} from "./auth.constants";
import { authRepository } from "./auth.repository";
import type {
  LoginInput,
  RegisterAdminInput,
  ResendRegistrationOtpInput,
  VerifyRegistrationInput,
} from "./auth.schemas";
import type {
  AuthenticatedRequestContext,
  OtpChannel,
  PublicShop,
  PublicUser,
} from "./auth.types";

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);
const addHours = (date: Date, hours: number) =>
  new Date(date.getTime() + hours * 60 * 60_000);

const buildPublicUser = (user: {
  id: string;
  shopId: string;
  role: "admin" | "staff" | "accountant";
  fullName: string;
  email: string;
  mobileNumber: string | null;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  mobileVerifiedAt: Date | null;
}): PublicUser => ({
  id: user.id,
  shopId: user.shopId,
  role: user.role,
  fullName: user.fullName,
  email: user.email,
  mobileNumber: user.mobileNumber ?? "",
  isActive: user.isActive,
  emailVerified: Boolean(user.emailVerifiedAt),
  mobileVerified: Boolean(user.mobileVerifiedAt),
});

const getRequiredMobileNumber = (user: {
  id: string;
  mobileNumber: string | null;
}) => {
  if (user.mobileNumber) {
    return user.mobileNumber;
  }

  throw new AppError({
    statusCode: 500,
    code: "MOBILE_NUMBER_MISSING",
    message:
      "The user record is missing a mobile number required for this operation.",
  });
};

const buildPublicShop = (shop: {
  id: string;
  name: string;
  slug: string;
  status: "pending_verification" | "active" | "suspended";
}): PublicShop => ({
  id: shop.id,
  name: shop.name,
  slug: shop.slug,
  status: shop.status,
});

const buildOtpDeliveryResult = (
  requestedChannels: OtpChannel[],
  results: PromiseSettledResult<void>[],
) => ({
  email: requestedChannels.includes("email")
    ? results[0]?.status === "fulfilled"
      ? "sent"
      : "failed"
    : "not_requested",
  mobile: requestedChannels.includes("mobile")
    ? results[1]?.status === "fulfilled"
      ? "sent"
      : "failed"
    : "not_requested",
});

class AuthService {
  private async generateUniqueShopSlug(shopName: string) {
    const baseSlug = toSlug(shopName) || "shop";
    const existing = await authRepository.listShopSlugsStartingWith(baseSlug);
    const existingSlugs = new Set(existing.map((item) => item.slug));

    if (!existingSlugs.has(baseSlug)) {
      return baseSlug;
    }

    let suffix = 2;

    while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
      suffix += 1;
    }

    return `${baseSlug}-${suffix}`;
  }

  private async deliverVerificationOtps(input: {
    email: string;
    fullName: string;
    shopName: string;
    otpCode: string;
    mobileNumber: string;
  }) {
    const results = await Promise.allSettled([
      emailService.sendRegistrationOtp({
        to: input.email,
        recipientName: input.fullName,
        shopName: input.shopName,
        otpCode: input.otpCode,
        expiresInMinutes: env.OTP_EXPIRY_MINUTES,
      }),
      smsService.sendRegistrationOtp({
        to: input.mobileNumber,
        otpCode: input.otpCode,
        expiresInMinutes: env.OTP_EXPIRY_MINUTES,
      }),
    ]);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        logger.warn("OTP delivery failed", {
          channel: index === 0 ? "email" : "mobile",
          message:
            result.reason instanceof Error
              ? result.reason.message
              : "Unknown provider error",
        });
      }
    });

    return buildOtpDeliveryResult(["email", "mobile"], results);
  }

  async registerAdmin(input: RegisterAdminInput) {
    const existingUser = await authRepository.findUserByEmailOrMobile(
      input.email,
      input.mobileNumber,
    );

    if (existingUser) {
      throw new AppError({
        statusCode: 409,
        code: "REGISTRATION_CONFLICT",
        message:
          existingUser.isActive ||
          existingUser.emailVerifiedAt ||
          existingUser.mobileVerifiedAt
            ? "An account with this email address or mobile number already exists."
            : "A registration with this email address or mobile number is already pending verification.",
      });
    }

    const now = new Date();
    const expiresAt = addMinutes(now, env.OTP_EXPIRY_MINUTES);
    const shopSlug = await this.generateUniqueShopSlug(input.shopName);
    const passwordHash = await hashPassword(input.password);
    const sharedOtp = generateNumericOtp();
    const emailOtpId = randomUUID();
    const mobileOtpId = randomUUID();

    const created = await db.transaction(async (tx) => {
      const shop = await authRepository.createShop(
        {
          name: input.shopName,
          slug: shopSlug,
          status: "pending_verification",
          createdAt: now,
        },
        tx,
      );

      const user = await authRepository.createUser(
        {
          shopId: shop.id,
          role: "admin",
          fullName: input.fullName,
          email: input.email,
          mobileNumber: input.mobileNumber,
          passwordHash,
          isActive: false,
          createdAt: now,
        },
        tx,
      );

      await authRepository.insertVerificationOtps(
        [
          {
            id: emailOtpId,
            userId: user.id,
            channel: "email",
            target: input.email,
            codeHash: hashOtpCode({
              otpId: emailOtpId,
              code: sharedOtp,
              channel: "email",
              purpose: "registration_verification",
              target: input.email,
            }),
            expiresAt,
            createdAt: now,
          },
          {
            id: mobileOtpId,
            userId: user.id,
            channel: "mobile",
            target: input.mobileNumber,
            codeHash: hashOtpCode({
              otpId: mobileOtpId,
              code: sharedOtp,
              channel: "mobile",
              purpose: "registration_verification",
              target: input.mobileNumber,
            }),
            expiresAt,
            createdAt: now,
          },
        ],
        tx,
      );

      return { shop, user };
    });

    const otpDelivery = await this.deliverVerificationOtps({
      email: input.email,
      fullName: input.fullName,
      shopName: input.shopName,
      otpCode: sharedOtp,
      mobileNumber: input.mobileNumber,
    });

    return {
      message:
        "Registration created successfully. Verify your email address and mobile number to activate the admin account.",
      pendingUserId: created.user.id,
      shop: buildPublicShop(created.shop),
      user: buildPublicUser(created.user),
      verification: {
        emailVerified: false,
        mobileVerified: false,
        expiresAt: expiresAt.toISOString(),
        otpDelivery,
      },
    };
  }

  async verifyRegistration(input: VerifyRegistrationInput) {
    const registration = await authRepository.findPendingRegistrationByContacts(
      input.email,
      input.mobileNumber,
    );

    if (!registration) {
      throw new AppError({
        statusCode: 404,
        code: "REGISTRATION_NOT_FOUND",
        message:
          "We could not find a pending registration for the provided details.",
      });
    }

    const now = new Date();
    const pendingChannels: OtpChannel[] = [];

    if (!registration.user.emailVerifiedAt) {
      pendingChannels.push("email");
    }

    if (!registration.user.mobileVerifiedAt) {
      pendingChannels.push("mobile");
    }

    if (!pendingChannels.length) {
      if (
        !registration.user.isActive ||
        registration.shop.status !== "active"
      ) {
        await db.transaction(async (tx) => {
          await authRepository.updateUserVerificationStatus(
            registration.user.id,
            { isActive: true },
            tx,
          );
          await authRepository.activateShop(registration.shop.id, tx);
        });
      }

      return {
        message: "Registration is already verified.",
        isCompleted: true,
        redirectTo: "/login",
        user: buildPublicUser({
          ...registration.user,
          isActive: true,
        }),
        shop: buildPublicShop({
          ...registration.shop,
          status: "active",
        }),
      };
    }

    const channelPayloads = await Promise.all(
      pendingChannels.map(async (channel) => {
        const target =
          channel === "email"
            ? registration.user.email
            : getRequiredMobileNumber(registration.user);
        const otp = await authRepository.findLatestOutstandingOtp({
          userId: registration.user.id,
          channel,
          target,
        });

        if (
          !otp ||
          otp.expiresAt <= now ||
          otp.invalidatedAt ||
          otp.consumedAt
        ) {
          throw new AppError({
            statusCode: 400,
            code: "OTP_INVALID",
            message:
              "The verification code is invalid or has expired. Please request a new code.",
          });
        }

        if (otp.attemptCount >= MAX_OTP_ATTEMPTS) {
          throw new AppError({
            statusCode: 429,
            code: "OTP_ATTEMPTS_EXCEEDED",
            message:
              "This verification code has been locked. Please request a new code.",
          });
        }

        const isValid = verifyOtpCodeHash({
          otpId: otp.id,
          code: input.otp,
          channel,
          purpose: "registration_verification",
          target,
          hashedCode: otp.codeHash,
        });

        if (!isValid) {
          const nextAttempt = otp.attemptCount + 1;
          await authRepository.incrementOtpAttempt(
            otp.id,
            nextAttempt >= MAX_OTP_ATTEMPTS,
          );
          throw new AppError({
            statusCode: 400,
            code: "OTP_INVALID",
            message:
              "The verification code is invalid or has expired. Please request a new code.",
          });
        }

        return { channel, otpId: otp.id };
      }),
    );

    const verifiedEmail =
      registration.user.emailVerifiedAt ||
      channelPayloads.some((item) => item.channel === "email");
    const verifiedMobile =
      registration.user.mobileVerifiedAt ||
      channelPayloads.some((item) => item.channel === "mobile");
    const isCompleted = Boolean(verifiedEmail && verifiedMobile);

    await db.transaction(async (tx) => {
      await authRepository.consumeOtps(
        channelPayloads.map((item) => item.otpId),
        tx,
      );

      const verificationUpdate: {
        emailVerifiedAt?: Date;
        mobileVerifiedAt?: Date;
        isActive: boolean;
      } = {
        isActive: isCompleted,
      };

      if (!registration.user.emailVerifiedAt && verifiedEmail) {
        verificationUpdate.emailVerifiedAt = now;
      }

      if (!registration.user.mobileVerifiedAt && verifiedMobile) {
        verificationUpdate.mobileVerifiedAt = now;
      }

      await authRepository.updateUserVerificationStatus(
        registration.user.id,
        verificationUpdate,
        tx,
      );

      if (isCompleted) {
        await authRepository.activateShop(registration.shop.id, tx);
      }
    });

    return {
      message: isCompleted
        ? "Email and mobile verification completed successfully."
        : "Verification updated successfully.",
      isCompleted,
      redirectTo: isCompleted ? "/login" : null,
      user: buildPublicUser({
        ...registration.user,
        emailVerifiedAt: verifiedEmail
          ? now
          : registration.user.emailVerifiedAt,
        mobileVerifiedAt: verifiedMobile
          ? now
          : registration.user.mobileVerifiedAt,
        isActive: isCompleted,
      }),
      shop: buildPublicShop({
        ...registration.shop,
        status: isCompleted ? "active" : registration.shop.status,
      }),
    };
  }

  async resendRegistrationOtp(input: ResendRegistrationOtpInput) {
    const registration = await authRepository.findPendingRegistrationByContacts(
      input.email,
      input.mobileNumber,
    );

    if (!registration) {
      throw new AppError({
        statusCode: 404,
        code: "REGISTRATION_NOT_FOUND",
        message:
          "We could not find a pending registration for the provided details.",
      });
    }

    const outstandingChannels = (input.channels ?? ["email", "mobile"]).filter(
      (channel) =>
        channel === "email"
          ? !registration.user.emailVerifiedAt
          : !registration.user.mobileVerifiedAt,
    ) as OtpChannel[];

    if (!outstandingChannels.length) {
      throw new AppError({
        statusCode: 400,
        code: "REGISTRATION_ALREADY_VERIFIED",
        message: "The registration has already been verified.",
      });
    }

    const now = new Date();

    for (const channel of outstandingChannels) {
      const latestOtp = await authRepository.findLatestOutstandingOtp({
        userId: registration.user.id,
        channel,
        target:
          channel === "email"
            ? registration.user.email
            : getRequiredMobileNumber(registration.user),
      });

      if (
        latestOtp &&
        latestOtp.lastSentAt.getTime() +
          env.OTP_RESEND_COOLDOWN_SECONDS * 1000 >
          now.getTime()
      ) {
        throw new AppError({
          statusCode: 429,
          code: "OTP_RESEND_COOLDOWN",
          message:
            "Please wait a little before requesting another verification code.",
        });
      }
    }

    const expiresAt = addMinutes(now, env.OTP_EXPIRY_MINUTES);
    const sharedOtp = generateNumericOtp();

    const otpRecords = outstandingChannels.map((channel) => {
      const otpId = randomUUID();
      const target =
        channel === "email"
          ? registration.user.email
          : getRequiredMobileNumber(registration.user);

      return {
        id: otpId,
        userId: registration.user.id,
        channel,
        target,
        codeHash: hashOtpCode({
          otpId,
          code: sharedOtp,
          channel,
          purpose: "registration_verification",
          target,
        }),
      };
    });

    await db.transaction(async (tx) => {
      await authRepository.invalidateOutstandingOtps(
        registration.user.id,
        outstandingChannels,
        tx,
      );
      await authRepository.insertVerificationOtps(
        otpRecords.map((record) => ({
          id: record.id,
          userId: record.userId,
          channel: record.channel,
          target: record.target,
          codeHash: record.codeHash,
          expiresAt,
          createdAt: now,
        })),
        tx,
      );
    });

    const results = await Promise.allSettled([
      outstandingChannels.includes("email")
        ? emailService.sendRegistrationOtp({
            to: registration.user.email,
            recipientName: registration.user.fullName,
            shopName: registration.shop.name,
            otpCode: sharedOtp,
            expiresInMinutes: env.OTP_EXPIRY_MINUTES,
          })
        : Promise.resolve(),
      outstandingChannels.includes("mobile")
        ? smsService.sendRegistrationOtp({
            to: getRequiredMobileNumber(registration.user),
            otpCode: sharedOtp,
            expiresInMinutes: env.OTP_EXPIRY_MINUTES,
          })
        : Promise.resolve(),
    ]);

    return {
      message: "New verification code sent successfully.",
      verification: {
        emailVerified: Boolean(registration.user.emailVerifiedAt),
        mobileVerified: Boolean(registration.user.mobileVerifiedAt),
        expiresAt: expiresAt.toISOString(),
        otpDelivery: buildOtpDeliveryResult(outstandingChannels, results),
      },
    };
  }

  async login(
    input: LoginInput,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const registration = await authRepository.findLoginUserByEmail(input.email);
    const now = new Date();

    if (!registration) {
      throw new AppError({
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
    }

    if (registration.user.lockedUntil && registration.user.lockedUntil > now) {
      throw new AppError({
        statusCode: 423,
        code: "LOGIN_LOCKED",
        message: "Too many failed login attempts. Please try again later.",
      });
    }

    const passwordMatches = await verifyPassword(
      input.password,
      registration.user.passwordHash,
    );

    if (!passwordMatches) {
      const nextAttemptCount = registration.user.failedLoginAttempts + 1;
      const lockedUntil =
        nextAttemptCount >= MAX_LOGIN_ATTEMPTS
          ? addMinutes(now, LOGIN_LOCK_DURATION_MINUTES)
          : null;

      await authRepository.updateUserVerificationStatus(registration.user.id, {
        failedLoginAttempts: nextAttemptCount,
        lockedUntil,
      });

      throw new AppError({
        statusCode: lockedUntil ? 423 : 401,
        code: lockedUntil ? "LOGIN_LOCKED" : "INVALID_CREDENTIALS",
        message: lockedUntil
          ? "Too many failed login attempts. Please try again later."
          : "Invalid email or password.",
      });
    }

    if (
      !registration.user.emailVerifiedAt ||
      !registration.user.mobileVerifiedAt
    ) {
      throw new AppError({
        statusCode: 403,
        code: "ACCOUNT_NOT_VERIFIED",
        message:
          "Please verify your email address and mobile number before signing in.",
      });
    }

    if (!registration.user.isActive || registration.shop.status !== "active") {
      throw new AppError({
        statusCode: 403,
        code: "ACCOUNT_INACTIVE",
        message:
          "Your account is not active. Please contact your administrator.",
      });
    }

    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);
    const sessionExpiresAt = addHours(now, env.AUTH_SESSION_TTL_HOURS);

    const session = await db.transaction(async (tx) => {
      await authRepository.updateUserVerificationStatus(
        registration.user.id,
        {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
        },
        tx,
      );

      const sessionInput: {
        userId: string;
        sessionTokenHash: string;
        expiresAt: Date;
        ipAddress?: string;
        userAgent?: string;
      } = {
        userId: registration.user.id,
        sessionTokenHash,
        expiresAt: sessionExpiresAt,
      };

      if (context.ipAddress) {
        sessionInput.ipAddress = context.ipAddress;
      }

      if (context.userAgent) {
        sessionInput.userAgent = context.userAgent;
      }

      return authRepository.createSession(sessionInput, tx);
    });

    return {
      message: "Login successful.",
      sessionToken,
      sessionId: session.id,
      sessionExpiresAt: sessionExpiresAt.toISOString(),
      user: buildPublicUser(registration.user),
      shop: buildPublicShop(registration.shop),
    };
  }

  async getSessionContext(
    rawSessionToken: string,
  ): Promise<AuthenticatedRequestContext | null> {
    const sessionTokenHash = hashSessionToken(rawSessionToken);
    const record =
      await authRepository.findSessionByTokenHash(sessionTokenHash);
    if (!record) {
      return null;
    }

    const now = new Date();

    if (
      record.session.expiresAt <= now ||
      record.session.revokedAt ||
      !record.user.isActive ||
      !record.user.emailVerifiedAt ||
      !record.user.mobileVerifiedAt ||
      record.shop.status !== "active"
    ) {
      await authRepository.revokeSessionByTokenHash(sessionTokenHash);
      return null;
    }

    await authRepository.touchSession(record.session.id);

    return {
      sessionId: record.session.id,
      sessionExpiresAt: record.session.expiresAt.toISOString(),
      user: buildPublicUser(record.user),
      shop: buildPublicShop(record.shop),
    };
  }

  async logout(rawSessionToken: string) {
    const sessionTokenHash = hashSessionToken(rawSessionToken);
    await authRepository.revokeSessionByTokenHash(sessionTokenHash);
  }
}

export const authService = new AuthService();
