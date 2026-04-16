import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../db/client";
import { userInvitations, users } from "../../db/schema";

export class UsersRepository {
  async listByShopId(shopId: string) {
    return db
      .select()
      .from(users)
      .where(eq(users.shopId, shopId))
      .orderBy(desc(users.createdAt));
  }

  async findById(userId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user ?? null;
  }

  async findByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user ?? null;
  }

  async updateUser(
    userId: string,
    payload: Partial<{ fullName: string; role: "staff" | "accountant" }>,
  ) {
    const [user] = await db
      .update(users)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return user ?? null;
  }

  async updateStatus(userId: string, isActive: boolean) {
    const [user] = await db
      .update(users)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return user ?? null;
  }

  async createInvitation(payload: {
    shopId: string;
    email: string;
    fullName: string;
    role: "staff" | "accountant";
    tokenHash: string;
    expiresAt: Date;
    invitedByUserId: string;
  }) {
    const [invitation] = await db
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

  async listInvitationsByShopId(shopId: string) {
    return db
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.shopId, shopId))
      .orderBy(desc(userInvitations.createdAt));
  }

  async findInvitationById(invitationId: string) {
    const [invitation] = await db
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.id, invitationId))
      .limit(1);

    return invitation ?? null;
  }

  async findActiveInvitationByEmail(shopId: string, email: string) {
    const [invitation] = await db
      .select()
      .from(userInvitations)
      .where(
        and(
          eq(userInvitations.shopId, shopId),
          eq(userInvitations.email, email),
          isNull(userInvitations.acceptedAt),
          isNull(userInvitations.revokedAt),
        ),
      )
      .orderBy(desc(userInvitations.createdAt))
      .limit(1);

    return invitation ?? null;
  }

  async findInvitationByTokenHash(tokenHash: string) {
    const [invitation] = await db
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
  ) {
    const [invitation] = await db
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

  async revokeInvitation(invitationId: string) {
    const [invitation] = await db
      .update(userInvitations)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userInvitations.id, invitationId))
      .returning();

    return invitation ?? null;
  }

  async createInvitedUser(payload: {
    shopId: string;
    role: "staff" | "accountant";
    fullName: string;
    email: string;
    passwordHash: string;
  }) {
    const now = new Date();
    const [user] = await db
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

  async markInvitationAccepted(invitationId: string, createdUserId: string) {
    const [invitation] = await db
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
}
