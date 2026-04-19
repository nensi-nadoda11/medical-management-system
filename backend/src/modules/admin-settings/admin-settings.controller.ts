import type { NextFunction, Request, Response } from "express";

import { AdminSettingsService } from "./admin-settings.service";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;
const getActor = (req: Request) => req.authenticatedUser ?? req.authSession!.user;

export class AdminSettingsController {
  constructor(private readonly adminSettingsService = new AdminSettingsService()) {}

  getPermissionCatalog = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      return res.status(200).json({
        data: this.adminSettingsService.getPermissionCatalog(),
      });
    } catch (error) {
      return next(error);
    }
  };

  getRolePermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.adminSettingsService.getRolePermissions(
        getShopId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  updateRolePermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.adminSettingsService.updateRolePermissions(
        getShopId(req),
        req.params.role as "admin" | "staff" | "accountant",
        req.body.permissions,
        getActor(req),
      );

      return res.status(200).json({
        message: "Role permissions updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  getUserPermissionDetail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.adminSettingsService.getUserPermissionDetail(
        getShopId(req),
        req.params.userId as string,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  updateUserPermissionOverrides = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.adminSettingsService.updateUserPermissionOverrides(
        getShopId(req),
        req.params.userId as string,
        req.body,
        getActor(req),
      );

      return res.status(200).json({
        message: "User permission overrides updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  getShopSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminSettingsService.getShopSettings(getShopId(req));

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  updateShopSettings = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.adminSettingsService.updateShopSettings(
        getShopId(req),
        req.body,
        getActor(req),
      );

      return res.status(200).json({
        message: "Admin settings updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  listAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminSettingsService.listAuditLogs(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };
}
