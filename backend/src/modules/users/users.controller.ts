import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/errors/app-error";
import { UsersService } from "./users.service";
import {
  acceptInvitationSchema,
  inviteUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from "./users.validation";

const getRequiredParam = (req: Request, paramName: string) => {
  const value = req.params[paramName];

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new AppError({
    statusCode: 400,
    code: "INVALID_ROUTE_PARAM",
    message: `Missing route parameter: ${paramName}.`,
  });
};

export class UsersController {
  constructor(private readonly usersService = new UsersService()) {}

  listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = (req.authenticatedUser ?? req.authSession!.user).shopId;
      const users = await this.usersService.listUsers(shopId);

      return res.status(200).json({ data: users });
    } catch (error) {
      return next(error);
    }
  };

  listInvitations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = (req.authenticatedUser ?? req.authSession!.user).shopId;
      const invitations = await this.usersService.listInvitations(shopId);

      return res.status(200).json({ data: invitations });
    } catch (error) {
      return next(error);
    }
  };

  inviteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = (req.authenticatedUser ?? req.authSession!.user).shopId;
      const invitedByUserId = (req.authenticatedUser ?? req.authSession!.user)
        .id;
      const payload = inviteUserSchema.parse(req.body);

      const result = await this.usersService.inviteUser(
        shopId,
        invitedByUserId,
        payload,
      );

      return res.status(201).json({
        message: "Invitation sent successfully.",
        data: result.invitation,
      });
    } catch (error) {
      return next(error);
    }
  };

  resendInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const shopId = (req.authenticatedUser ?? req.authSession!.user).shopId;
      const invitation = await this.usersService.resendInvitation(
        shopId,
        getRequiredParam(req, "id"),
      );

      return res.status(200).json({
        message: "Invitation resent successfully.",
        data: invitation,
      });
    } catch (error) {
      return next(error);
    }
  };

  revokeInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const shopId = (req.authenticatedUser ?? req.authSession!.user).shopId;
      const invitation = await this.usersService.revokeInvitation(
        shopId,
        getRequiredParam(req, "id"),
      );

      return res.status(200).json({
        message: "Invitation revoked successfully.",
        data: invitation,
      });
    } catch (error) {
      return next(error);
    }
  };

  getInvitationByToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const invitation = await this.usersService.getInvitationByToken(
        getRequiredParam(req, "token"),
      );

      return res.status(200).json({
        data: {
          fullName: invitation.fullName,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  acceptInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const payload = acceptInvitationSchema.parse(req.body);
      const user = await this.usersService.acceptInvitation(payload);

      return res.status(201).json({
        message: "Password set successfully. You can now log in.",
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = (req.authenticatedUser ?? req.authSession!.user).shopId;
      const currentUserId = (req.authenticatedUser ?? req.authSession!.user).id;
      const payload = updateUserSchema.parse(req.body);

      const user = await this.usersService.updateUser(
        shopId,
        getRequiredParam(req, "id"),
        payload,
        currentUserId,
      );

      return res.status(200).json({
        message: "User updated successfully.",
        data: user,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateUserStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const shopId = (req.authenticatedUser ?? req.authSession!.user).shopId;
      const currentUserId = (req.authenticatedUser ?? req.authSession!.user).id;
      const payload = updateUserStatusSchema.parse(req.body);

      const user = await this.usersService.updateUserStatus(
        shopId,
        getRequiredParam(req, "id"),
        payload,
        currentUserId,
      );

      return res.status(200).json({
        message: "User status updated successfully.",
        data: user,
      });
    } catch (error) {
      return next(error);
    }
  };
}
