import type { NextFunction, Request, Response } from "express";

import { AuditLogsService } from "./audit-logs.service";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;

export class AuditLogsController {
  constructor(private readonly auditLogsService = new AuditLogsService()) {}

  listAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.auditLogsService.listAuditLogs(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getAuditLogById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.auditLogsService.getAuditLogById(
        getShopId(req),
        req.params.id as string,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  listRecentActivity = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.auditLogsService.listRecentActivity(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };
}
