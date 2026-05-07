import type { NextFunction, Request, Response } from "express";

import { NotificationsService } from "./notifications.service";

const getUser = (req: Request) => req.authenticatedUser ?? req.authSession!.user;
const getShopId = (req: Request) => getUser(req).shopId;
const getBranchId = (req: Request) => req.authBranch!.id;
const getNotificationId = (req: Request) => req.params.id as string;

export class NotificationsController {
  constructor(
    private readonly notificationsService = new NotificationsService(),
  ) {}

  listNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.notificationsService.listNotifications(
        getShopId(req),
        getBranchId(req),
        getUser(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.notificationsService.getUnreadCount(
        getShopId(req),
        getBranchId(req),
        getUser(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.notificationsService.getSummary(
        getShopId(req),
        getBranchId(req),
        getUser(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.notificationsService.markAsRead(
        getShopId(req),
        getBranchId(req),
        getUser(req),
        getNotificationId(req),
      );

      return res.status(200).json({
        message: "Notification marked as read.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  acknowledge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.notificationsService.acknowledge(
        getShopId(req),
        getBranchId(req),
        getUser(req),
        getNotificationId(req),
      );

      return res.status(200).json({
        message: "Notification acknowledged.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  bulkMarkRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.notificationsService.bulkMarkRead(
        getShopId(req),
        getBranchId(req),
        getUser(req),
        req.body,
      );

      return res.status(200).json({
        message: "Notifications marked as read.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };
}
