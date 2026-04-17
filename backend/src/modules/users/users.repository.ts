import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { authSessions, userInvitations, users } from "../../db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | Transaction;

const getExecutor = (executor?: DbExecutor) => executor ?? db;

export class UsersRepository {
  async listByShopId(shopId: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    return database
      .select()
      .from(users)
      .where(eq(users.shopId, shopId))
      .orderBy(desc(users.createdAt));
  }

  async findById(userId: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user ?? null;
  }

  async findByEmail(email: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    const [user] = await database
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);
    return user ?? null;
  }

  async updateUser(
    userId: string,
    payload: Partial<{
      fullName: string;
      email: string;
      role: "staff" | "accountant";
    }>,
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const [user] = await database
      .update(users)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return user ?? null;
  }

  async updateStatus(
    userId: string,
    isActive: boolean,
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const [user] = await database
      .update(users)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return user ?? null;
  }

  async createInvitation(
    payload: {
      shopId: string;
      email: string;
      fullName: string;
      role: "staff" | "accountant";
      tokenHash: string;
      expiresAt: Date;
      invitedByUserId: string;
    },
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const [invitation] = await database
      .insert(userInvitations)
      .values({
        shopId: payload.shopId,
        email: payload.email,
        fullName: payload.fullName,
        role: payload.role,
        tokenHash: payload.tokenHash,
        expiresAt: payload.expiresAt,
        invitedByUserId: payload.invitedByUserId,
      })
      .returning();

    return invitation;
  }

  async deleteInvitation(invitationId: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    await database
      .delete(userInvitations)
      .where(eq(userInvitations.id, invitationId));
  }

  async listInvitationsByShopId(shopId: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    return database
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.shopId, shopId))
      .orderBy(desc(userInvitations.createdAt));
  }

  async findInvitationById(invitationId: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    const [invitation] = await database
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.id, invitationId))
      .limit(1);

    return invitation ?? null;
  }

  async findActiveInvitationByEmail(
    shopId: string,
    email: string,
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const [invitation] = await database
      .select()
      .from(userInvitations)
      .where(
        and(
          eq(userInvitations.shopId, shopId),
          sql`lower(${userInvitations.email}) = lower(${email})`,
          isNull(userInvitations.acceptedAt),
          isNull(userInvitations.revokedAt),
        ),
      )
      .orderBy(desc(userInvitations.createdAt))
      .limit(1);

    return invitation ?? null;
  }

  async findInvitationByTokenHash(tokenHash: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    const [invitation] = await database
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.tokenHash, tokenHash))
      .limit(1);

    return invitation ?? null;
  }

  async touchInvitationSent(
    invitationId: string,
    tokenHash: string,
    expiresAt: Date,
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const [invitation] = await database
      .update(userInvitations)
      .set({
        tokenHash,
        expiresAt,
        lastSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userInvitations.id, invitationId))
      .returning();

    return invitation ?? null;
  }

  async restoreInvitationAfterFailedSend(
    invitationId: string,
    payload: {
      tokenHash: string;
      expiresAt: Date;
      lastSentAt: Date;
    },
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    await database
      .update(userInvitations)
      .set({
        tokenHash: payload.tokenHash,
        expiresAt: payload.expiresAt,
        lastSentAt: payload.lastSentAt,
        updatedAt: new Date(),
      })
      .where(eq(userInvitations.id, invitationId));
  }

  async revokeInvitation(invitationId: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    const [invitation] = await database
      .update(userInvitations)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userInvitations.id, invitationId))
      .returning();

    return invitation ?? null;
  }

  async createInvitedUser(
    payload: {
      shopId: string;
      role: "staff" | "accountant";
      fullName: string;
      email: string;
      passwordHash: string;
    },
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const now = new Date();
    const [user] = await database
      .insert(users)
      .values({
        shopId: payload.shopId,
        role: payload.role,
        fullName: payload.fullName,
        email: payload.email,
        mobileNumber: null,
        passwordHash: payload.passwordHash,
        emailVerifiedAt: now,
        mobileVerifiedAt: now,
        isActive: true,
      })
      .returning();

    if (!user) {
      throw new Error("Failed to create invited user.");
    }

    return user;
  }

  async markInvitationAccepted(
    invitationId: string,
    createdUserId: string,
    executor?: DbExecutor,
  ) {
    const database = getExecutor(executor);
    const [invitation] = await database
      .update(userInvitations)
      .set({
        acceptedAt: new Date(),
        createdUserId,
        updatedAt: new Date(),
      })
      .where(eq(userInvitations.id, invitationId))
      .returning();

    return invitation ?? null;
  }

  async revokeSessionsByUserId(userId: string, executor?: DbExecutor) {
    const database = getExecutor(executor);
    await database
      .update(authSessions)
      .set({
        revokedAt: new Date(),
      })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
  }
}
