import { env } from "../../config/env";
import { AppError } from "../../shared/errors/app-error";
import { hashPassword } from "../../shared/security/password";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "../../shared/utils/invitation_token";
import { emailService } from "../notifications/email/email.service";
import { UsersRepository } from "./users.repository";
import type {
  AcceptInvitationInput,
  InviteUserInput,
  UpdateUserInput,
  UpdateUserStatusInput,
} from "./users.validation";

const getAppBaseUrl = () => env.allowedOrigins[0] ?? "http://localhost:5173";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

export class UsersService {
  constructor(private readonly usersRepository = new UsersRepository()) {}

  async listUsers(shopId: string) {
    return this.usersRepository.listByShopId(shopId);
  }

  async listInvitations(shopId: string) {
    return this.usersRepository.listInvitationsByShopId(shopId);
  }

  async inviteUser(
    shopId: string,
    invitedByUserId: string,
    input: InviteUserInput,
  ) {
    const existingUser = await this.usersRepository.findByEmail(input.email);

    if (existingUser) {
      throw buildAppError(
        409,
        "USER_ALREADY_EXISTS",
        "A user with this email already exists.",
      );
    }

    const activeInvitation =
      await this.usersRepository.findActiveInvitationByEmail(shopId, input.email);

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
          email: input.email,
          fullName: input.fullName,
          role: input.role,
          tokenHash,
          expiresAt,
          invitedByUserId,
        });

    const inviteLink = `${getAppBaseUrl()}/set-password?token=${token}`;

    await emailService.send({
      to: input.email,
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

    return {
      invitation,
      inviteLink,
    };
  }

  async resendInvitation(shopId: string, invitationId: string) {
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
    const inviteLink = `${getAppBaseUrl()}/set-password?token=${token}`;

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

    return updatedInvitation;
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

    return this.usersRepository.revokeInvitation(invitationId);
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
      throw buildAppError(
        500,
        "INVITATION_ROLE_INVALID",
        "The invitation role is not supported for user creation.",
      );
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.usersRepository.createInvitedUser({
      shopId: invitation.shopId,
      role: invitation.role,
      fullName: invitation.fullName,
      email: invitation.email,
      passwordHash,
    });

    await this.usersRepository.markInvitationAccepted(invitation.id, user.id);

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

    const payload: {
      fullName?: string;
      role?: "staff" | "accountant";
    } = {};

    if (input.fullName !== undefined) {
      payload.fullName = input.fullName;
    }

    if (input.role !== undefined) {
      payload.role = input.role;
    }

    const updatedUser = await this.usersRepository.updateUser(userId, payload);

    if (!updatedUser) {
      throw buildAppError(
        500,
        "USER_UPDATE_FAILED",
        "Failed to update user.",
      );
    }

    return updatedUser;
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

    const updatedUser = await this.usersRepository.updateStatus(
      userId,
      input.isActive,
    );

    if (!updatedUser) {
      throw buildAppError(
        500,
        "USER_STATUS_UPDATE_FAILED",
        "Failed to update user status.",
      );
    }

    return updatedUser;
  }
}
