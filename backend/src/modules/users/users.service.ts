import { env } from "../../config/env";
import { resolveAppBaseUrl } from "../../config/runtime-config";
import { db } from "../../db/client";
import { AppError } from "../../shared/errors/app-error";
import { hashPassword } from "../../shared/security/password";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "../../shared/utils/invitation_token";
import { normalizeEmail } from "../../shared/utils/strings";
import { emailService } from "../notifications/email/email.service";
import { UsersRepository } from "./users.repository";
import type {
  AcceptInvitationInput,
  InviteUserInput,
  UpdateUserInput,
  UpdateUserStatusInput,
} from "./users.validation";

const getAppBaseUrl = () =>
  resolveAppBaseUrl({
    nodeEnv: env.NODE_ENV,
    appBaseUrl: env.APP_BASE_URL,
    allowedOrigins: env.allowedOrigins,
  });

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

const buildSafeInternalError = (message: string) =>
  new AppError({
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    message,
    expose: false,
  });

const toPublicUser = (user: {
  id: string;
  shopId: string;
  role: "admin" | "staff" | "accountant";
  fullName: string;
  email: string;
  mobileNumber: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: user.id,
  shopId: user.shopId,
  role: user.role,
  fullName: user.fullName,
  email: user.email,
  mobileNumber: user.mobileNumber,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const toPublicInvitation = (invitation: {
  id: string;
  shopId: string;
  email: string;
  fullName: string;
  role: "admin" | "staff" | "accountant";
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  lastSentAt: Date;
  invitedByUserId: string;
  createdUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: invitation.id,
  shopId: invitation.shopId,
  email: invitation.email,
  fullName: invitation.fullName,
  role: invitation.role,
  expiresAt: invitation.expiresAt,
  acceptedAt: invitation.acceptedAt,
  revokedAt: invitation.revokedAt,
  lastSentAt: invitation.lastSentAt,
  invitedByUserId: invitation.invitedByUserId,
  createdUserId: invitation.createdUserId,
  createdAt: invitation.createdAt,
  updatedAt: invitation.updatedAt,
});

export class UsersService {
  constructor(private readonly usersRepository = new UsersRepository()) {}

  async listUsers(shopId: string) {
    const users = await this.usersRepository.listByShopId(shopId);
    return users.map(toPublicUser);
  }

  async listInvitations(shopId: string) {
    const invitations = await this.usersRepository.listInvitationsByShopId(shopId);
    return invitations.map(toPublicInvitation);
  }

  async inviteUser(
    shopId: string,
    invitedByUserId: string,
    input: InviteUserInput,
  ) {
    const appBaseUrl = getAppBaseUrl();
    const normalizedEmail = normalizeEmail(input.email);
    const existingUser = await this.usersRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      throw buildAppError(
        409,
        "USER_ALREADY_EXISTS",
        "A user with this email already exists.",
      );
    }

    const activeInvitation = await this.usersRepository.findActiveInvitationByEmail(
      shopId,
      normalizedEmail,
    );

    if (activeInvitation) {
      const now = Date.now();
      const lastSent = new Date(activeInvitation.lastSentAt).getTime();
      const cooldownMs = env.INVITATION_RESEND_COOLDOWN_SECONDS * 1000;

      if (now - lastSent < cooldownMs) {
        throw buildAppError(
          429,
          "INVITATION_RESEND_COOLDOWN",
          "Please wait before sending another invitation.",
        );
      }
    }

    const token = generateInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date(
      Date.now() + env.INVITATION_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    const invitation = activeInvitation
      ? await this.usersRepository.touchInvitationSent(
          activeInvitation.id,
          tokenHash,
          expiresAt,
        )
      : await this.usersRepository.createInvitation({
          shopId,
          email: normalizedEmail,
          fullName: input.fullName,
          role: input.role,
          tokenHash,
          expiresAt,
          invitedByUserId,
        });

    if (!invitation) {
      throw buildSafeInternalError("Failed to create the invitation.");
    }

    const inviteLink = `${appBaseUrl}/set-password?token=${token}`;

    try {
      await emailService.send({
        to: normalizedEmail,
        subject: "You have been invited to join Medical Management System",
        html: `
          <p>Hello ${input.fullName},</p>
          <p>You have been invited as <strong>${input.role}</strong>.</p>
          <p>Click the button below to set your password and activate your account:</p>
          <p><a href="${inviteLink}" target="_blank" rel="noopener noreferrer">Set Password</a></p>
          <p>This link will expire in ${env.INVITATION_EXPIRY_HOURS} hours.</p>
        `,
        text: `Hello ${input.fullName}, you have been invited as ${input.role}. Set your password here: ${inviteLink}`,
      });
    } catch {
      if (activeInvitation) {
        await this.usersRepository.restoreInvitationAfterFailedSend(activeInvitation.id, {
          tokenHash: activeInvitation.tokenHash,
          expiresAt: activeInvitation.expiresAt,
          lastSentAt: activeInvitation.lastSentAt,
        });
      } else {
        await this.usersRepository.deleteInvitation(invitation.id);
      }

      throw buildSafeInternalError(
        "Unable to send the invitation email right now. Please try again in a moment.",
      );
    }

    return {
      invitation: toPublicInvitation(invitation),
      inviteLink,
    };
  }

  async resendInvitation(shopId: string, invitationId: string) {
    const appBaseUrl = getAppBaseUrl();
    const invitation = await this.usersRepository.findInvitationById(invitationId);

    if (!invitation || invitation.shopId !== shopId) {
      throw buildAppError(404, "INVITATION_NOT_FOUND", "Invitation not found.");
    }

    if (invitation.acceptedAt) {
      throw buildAppError(
        400,
        "INVITATION_ALREADY_ACCEPTED",
        "This invitation has already been accepted.",
      );
    }

    if (invitation.revokedAt) {
      throw buildAppError(
        400,
        "INVITATION_ALREADY_REVOKED",
        "This invitation has already been revoked.",
      );
    }

    const now = Date.now();
    const lastSent = new Date(invitation.lastSentAt).getTime();
    const cooldownMs = env.INVITATION_RESEND_COOLDOWN_SECONDS * 1000;

    if (now - lastSent < cooldownMs) {
      throw buildAppError(
        429,
        "INVITATION_RESEND_COOLDOWN",
        "Please wait before resending this invitation.",
      );
    }

    const token = generateInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date(
      Date.now() + env.INVITATION_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    const updatedInvitation = await this.usersRepository.touchInvitationSent(
      invitation.id,
      tokenHash,
      expiresAt,
    );

    if (!updatedInvitation) {
      throw buildSafeInternalError("Failed to update the invitation.");
    }

    const inviteLink = `${appBaseUrl}/set-password?token=${token}`;

    try {
      await emailService.send({
        to: invitation.email,
        subject: "Your invitation link has been resent",
        html: `
          <p>Hello ${invitation.fullName},</p>
          <p>Click below to activate your account:</p>
          <p><a href="${inviteLink}" target="_blank" rel="noopener noreferrer">Set Password</a></p>
          <p>This link will expire in ${env.INVITATION_EXPIRY_HOURS} hours.</p>
        `,
        text: `Set your password here: ${inviteLink}`,
      });
    } catch {
      await this.usersRepository.restoreInvitationAfterFailedSend(invitation.id, {
        tokenHash: invitation.tokenHash,
        expiresAt: invitation.expiresAt,
        lastSentAt: invitation.lastSentAt,
      });

      throw buildSafeInternalError(
        "Unable to resend the invitation email right now. Please try again shortly.",
      );
    }

    return toPublicInvitation(updatedInvitation);
  }

  async revokeInvitation(shopId: string, invitationId: string) {
    const invitation = await this.usersRepository.findInvitationById(invitationId);

    if (!invitation || invitation.shopId !== shopId) {
      throw buildAppError(404, "INVITATION_NOT_FOUND", "Invitation not found.");
    }

    if (invitation.acceptedAt) {
      throw buildAppError(
        400,
        "INVITATION_ALREADY_ACCEPTED",
        "Accepted invitations cannot be revoked.",
      );
    }

    if (invitation.revokedAt) {
      throw buildAppError(
        400,
        "INVITATION_ALREADY_REVOKED",
        "Invitation is already revoked.",
      );
    }

    const revokedInvitation = await this.usersRepository.revokeInvitation(invitationId);

    if (!revokedInvitation) {
      throw buildSafeInternalError("Failed to revoke the invitation.");
    }

    return toPublicInvitation(revokedInvitation);
  }

  async getInvitationByToken(token: string) {
    const invitation = await this.usersRepository.findInvitationByTokenHash(
      hashInvitationToken(token),
    );

    if (!invitation) {
      throw buildAppError(
        404,
        "INVITATION_NOT_FOUND",
        "Invitation not found or invalid.",
      );
    }

    if (invitation.revokedAt) {
      throw buildAppError(
        400,
        "INVITATION_REVOKED",
        "This invitation has been revoked.",
      );
    }

    if (invitation.acceptedAt) {
      throw buildAppError(
        400,
        "INVITATION_ALREADY_USED",
        "This invitation has already been used.",
      );
    }

    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      throw buildAppError(
        400,
        "INVITATION_EXPIRED",
        "This invitation has expired.",
      );
    }

    return invitation;
  }

  async acceptInvitation(input: AcceptInvitationInput) {
    const invitation = await this.getInvitationByToken(input.token);
    const existingUser = await this.usersRepository.findByEmail(invitation.email);

    if (existingUser) {
      throw buildAppError(
        409,
        "USER_ALREADY_EXISTS",
        "A user with this email already exists.",
      );
    }

    if (invitation.role !== "staff" && invitation.role !== "accountant") {
      throw buildSafeInternalError(
        "The invitation role is not supported for user creation.",
      );
    }

    const invitedRole = invitation.role;
    const passwordHash = await hashPassword(input.password);
    const user = await db.transaction(async (tx) => {
      const createdUser = await this.usersRepository.createInvitedUser(
        {
          shopId: invitation.shopId,
          role: invitedRole,
          fullName: invitation.fullName,
          email: invitation.email,
          passwordHash,
        },
        tx,
      );

      await this.usersRepository.markInvitationAccepted(
        invitation.id,
        createdUser.id,
        tx,
      );

      return createdUser;
    });

    return user;
  }

  async updateUser(
    shopId: string,
    userId: string,
    input: UpdateUserInput,
    currentUserId: string,
  ) {
    const user = await this.usersRepository.findById(userId);

    if (!user || user.shopId !== shopId) {
      throw buildAppError(404, "USER_NOT_FOUND", "User not found.");
    }

    if (user.role === "admin") {
      throw buildAppError(
        400,
        "ADMIN_USER_PROTECTED",
        "Admin user cannot be modified here.",
      );
    }

    if (user.id === currentUserId && input.role && input.role !== user.role) {
      throw buildAppError(
        400,
        "SELF_ROLE_CHANGE_FORBIDDEN",
        "You cannot change your own role.",
      );
    }

    if (input.email !== undefined) {
      const existingUserWithEmail = await this.usersRepository.findByEmail(input.email);

      if (existingUserWithEmail && existingUserWithEmail.id !== user.id) {
        throw buildAppError(
          409,
          "USER_EMAIL_CONFLICT",
          "Another user already uses this email address.",
        );
      }
    }

    const payload: {
      fullName?: string;
      email?: string;
      role?: "staff" | "accountant";
    } = {};

    if (input.fullName !== undefined) {
      payload.fullName = input.fullName;
    }

    if (input.email !== undefined) {
      payload.email = input.email;
    }

    if (input.role !== undefined) {
      payload.role = input.role;
    }

    const updatedUser = await this.usersRepository.updateUser(userId, payload);

    if (!updatedUser) {
      throw buildSafeInternalError("Failed to update user.");
    }

    return toPublicUser(updatedUser);
  }

  async updateUserStatus(
    shopId: string,
    userId: string,
    input: UpdateUserStatusInput,
    currentUserId: string,
  ) {
    const user = await this.usersRepository.findById(userId);

    if (!user || user.shopId !== shopId) {
      throw buildAppError(404, "USER_NOT_FOUND", "User not found.");
    }

    if (user.role === "admin") {
      throw buildAppError(
        400,
        "ADMIN_USER_PROTECTED",
        "Admin user status cannot be changed here.",
      );
    }

    if (user.id === currentUserId) {
      throw buildAppError(
        400,
        "SELF_STATUS_CHANGE_FORBIDDEN",
        "You cannot change your own active status.",
      );
    }

    const updatedUser = await db.transaction(async (tx) => {
      const nextUser = await this.usersRepository.updateStatus(
        userId,
        input.isActive,
        tx,
      );

      if (!nextUser) {
        return null;
      }

      if (!input.isActive) {
        await this.usersRepository.revokeSessionsByUserId(userId, tx);
      }

      return nextUser;
    });

    if (!updatedUser) {
      throw buildSafeInternalError("Failed to update user status.");
    }

    return toPublicUser(updatedUser);
  }
}
