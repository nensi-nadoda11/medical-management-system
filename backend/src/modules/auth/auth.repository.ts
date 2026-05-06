import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  like,
  or,
  sql,
} from "drizzle-orm";

import { db } from "../../db/client";
import {
  authSessions,
  shops,
  users,
  verificationOtps,
} from "../../db/schema";
import { REGISTRATION_OTP_PURPOSE } from "./auth.constants";
import type { OtpChannel } from "./auth.types";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | Transaction;

const getExecutor = (executor?: DbExecutor) => executor ?? db;

export const authRepository = {
  async findUserByEmailOrMobile(email: string, mobileNumber: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    const [result] = await database
      .select()
      .from(users)
      .where(
        or(
          sql`lower(${users.email}) = lower(${email})`,
          eq(users.mobileNumber, mobileNumber),
        ),
      )
      .limit(1);

    return result ?? null;
  },

  async listShopSlugsStartingWith(baseSlug: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    return database
      .select({ slug: shops.slug })
      .from(shops)
      .where(like(shops.slug, `${baseSlug}%`));
  },

  async createShop(
    input: {
      name: string;
      slug: string;
      status: "pending_verification" | "active" | "suspended";
      phone: string;
      email: string;
      createdAt: Date;
    },
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const [createdShop] = await database
      .insert(shops)
      .values({
        name: input.name,
        slug: input.slug,
        status: input.status,
        phone: input.phone,
        email: input.email,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning();

    if (!createdShop) {
      throw new Error("Failed to create shop.");
    }

    return createdShop;
  },

  async createUser(
    input: {
      shopId: string;
      role: "admin" | "staff" | "accountant";
      fullName: string;
      email: string;
      mobileNumber: string;
      passwordHash: string;
      isActive: boolean;
      createdAt: Date;
    },
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const [createdUser] = await database
      .insert(users)
      .values({
        shopId: input.shopId,
        role: input.role,
        fullName: input.fullName,
        email: input.email,
        mobileNumber: input.mobileNumber,
        passwordHash: input.passwordHash,
        isActive: input.isActive,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning();

    if (!createdUser) {
      throw new Error("Failed to create user.");
    }

    return createdUser;
  },

  async insertVerificationOtps(
    values: Array<{
      id: string;
      userId: string;
      channel: OtpChannel;
      target: string;
      codeHash: string;
      expiresAt: Date;
      createdAt: Date;
    }>,
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    return database.insert(verificationOtps).values(
      values.map((value) => ({
        ...value,
        purpose: REGISTRATION_OTP_PURPOSE as "registration_verification",
        lastSentAt: value.createdAt,
      })),
    );
  },

  async findPendingRegistrationByContacts(
    email: string,
    mobileNumber: string,
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const [result] = await database
      .select({ user: users, shop: shops })
      .from(users)
      .innerJoin(shops, eq(users.shopId, shops.id))
      .where(
        and(
          sql`lower(${users.email}) = lower(${email})`,
          eq(users.mobileNumber, mobileNumber),
        ),
      )
      .limit(1);

    return result ?? null;
  },

  async findLatestOutstandingOtp(
    input: {
      userId: string;
      channel: OtpChannel;
      target: string;
    },
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const [otp] = await database
      .select()
      .from(verificationOtps)
      .where(
        and(
          eq(verificationOtps.userId, input.userId),
          eq(verificationOtps.purpose, REGISTRATION_OTP_PURPOSE),
          eq(verificationOtps.channel, input.channel),
          eq(verificationOtps.target, input.target),
          isNull(verificationOtps.consumedAt),
          isNull(verificationOtps.invalidatedAt),
        ),
      )
      .orderBy(desc(verificationOtps.createdAt))
      .limit(1);

    return otp ?? null;
  },

  async incrementOtpAttempt(otpId: string, invalidate: boolean, executor?: DbExecutor) {
    const database = getExecutor(executor);
    const now = new Date();

    if (invalidate) {
      await database
        .update(verificationOtps)
        .set({
          attemptCount: sql`${verificationOtps.attemptCount} + 1`,
          invalidatedAt: now,
        })
        .where(eq(verificationOtps.id, otpId));
      return;
    }

    await database
      .update(verificationOtps)
      .set({
        attemptCount: sql`${verificationOtps.attemptCount} + 1`,
      })
      .where(eq(verificationOtps.id, otpId));
  },

  async invalidateOutstandingOtps(userId: string, channels: OtpChannel[], executor?: DbExecutor) {
    if (!channels.length) {
      return;
    }

    const database = getExecutor(executor);
    await database
      .update(verificationOtps)
      .set({
        invalidatedAt: new Date(),
      })
      .where(
        and(
          eq(verificationOtps.userId, userId),
          eq(verificationOtps.purpose, REGISTRATION_OTP_PURPOSE),
          inArray(verificationOtps.channel, channels),
          isNull(verificationOtps.consumedAt),
          isNull(verificationOtps.invalidatedAt),
        ),
      );
  },

  async consumeOtps(otpIds: string[], executor?: DbExecutor) {
    if (!otpIds.length) {
      return;
    }

    const database = getExecutor(executor);
    await database
      .update(verificationOtps)
      .set({
        consumedAt: new Date(),
      })
      .where(inArray(verificationOtps.id, otpIds));
  },

  async updateUserVerificationStatus(
    userId: string,
    input: {
      emailVerifiedAt?: Date;
      mobileVerifiedAt?: Date;
      isActive?: boolean;
      lastLoginAt?: Date;
      failedLoginAttempts?: number;
      lockedUntil?: Date | null;
    },
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.emailVerifiedAt !== undefined) {
      values.emailVerifiedAt = input.emailVerifiedAt;
    }

    if (input.mobileVerifiedAt !== undefined) {
      values.mobileVerifiedAt = input.mobileVerifiedAt;
    }

    if (input.isActive !== undefined) {
      values.isActive = input.isActive;
    }

    if (input.lastLoginAt !== undefined) {
      values.lastLoginAt = input.lastLoginAt;
    }

    if (input.failedLoginAttempts !== undefined) {
      values.failedLoginAttempts = input.failedLoginAttempts;
    }

    if (input.lockedUntil !== undefined) {
      values.lockedUntil = input.lockedUntil;
    }

    const [updatedUser] = await database
      .update(users)
      .set(values)
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error("Failed to update user.");
    }

    return updatedUser;
  },

  async activateShop(shopId: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    const now = new Date();
    const [updatedShop] = await database
      .update(shops)
      .set({
        status: "active",
        activatedAt: now,
        updatedAt: now,
      })
      .where(eq(shops.id, shopId))
      .returning();

    if (!updatedShop) {
      throw new Error("Failed to update shop.");
    }

    return updatedShop;
  },

  async findLoginUserByEmail(email: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    const [result] = await database
      .select({ user: users, shop: shops })
      .from(users)
      .innerJoin(shops, eq(users.shopId, shops.id))
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);

    return result ?? null;
  },

  async createSession(
    input: {
      userId: string;
      sessionTokenHash: string;
      expiresAt: Date;
      ipAddress?: string;
      userAgent?: string;
    },
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const [session] = await database
      .insert(authSessions)
      .values({
        userId: input.userId,
        sessionTokenHash: input.sessionTokenHash,
        expiresAt: input.expiresAt,
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
        ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      })
      .returning();

    if (!session) {
      throw new Error("Failed to create session.");
    }

    return session;
  },

  async findSessionByTokenHash(sessionTokenHash: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    const [result] = await database
      .select({ session: authSessions, user: users, shop: shops })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .innerJoin(shops, eq(users.shopId, shops.id))
      .where(
        and(
          eq(authSessions.sessionTokenHash, sessionTokenHash),
          isNull(authSessions.revokedAt),
        ),
      )
      .limit(1);

    return result ?? null;
  },

  async touchSession(sessionId: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    await database
      .update(authSessions)
      .set({
        lastUsedAt: new Date(),
      })
      .where(eq(authSessions.id, sessionId));
  },

  async revokeSessionByTokenHash(sessionTokenHash: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    await database
      .update(authSessions)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(authSessions.sessionTokenHash, sessionTokenHash));
  },
};
