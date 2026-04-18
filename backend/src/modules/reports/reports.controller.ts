import type { NextFunction, Request, Response } from "express";

import { ReportsService } from "./reports.service";

const getAuthContext = (req: Request) => {
  const user = req.authenticatedUser ?? req.authSession!.user;
  const shop = req.authSession?.shop;

  return {
    shopId: user.shopId,
    userId: user.id,
    role: user.role,
    shopName: shop?.name ?? "Medical Management System",
  };
};

export class ReportsController {
  constructor(private readonly reportsService = new ReportsService()) {}

  getDashboardSummary = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const auth = getAuthContext(req);
      const result = await this.reportsService.getDashboardSummary(
        auth.shopId,
        {
          userId: auth.userId,
          role: auth.role,
        },
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getSalesReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = getAuthContext(req);
      const result = await this.reportsService.getSalesReport(
        auth.shopId,
        {
          userId: auth.userId,
          role: auth.role,
        },
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  exportSalesReport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const auth = getAuthContext(req);
      const exportResult = await this.reportsService.exportSalesReport(
        auth.shopId,
        auth.shopName,
        {
          userId: auth.userId,
          role: auth.role,
        },
        (req.validatedQuery ?? req.query) as never,
      );

      res.setHeader("Content-Type", exportResult.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportResult.fileName}"`,
      );

      return res.status(200).send(exportResult.buffer);
    } catch (error) {
      return next(error);
    }
  };

  getProfitReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = getAuthContext(req);
      const result = await this.reportsService.getProfitReport(
        auth.shopId,
        {
          userId: auth.userId,
          role: auth.role,
        },
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  exportProfitReport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const auth = getAuthContext(req);
      const exportResult = await this.reportsService.exportProfitReport(
        auth.shopId,
        auth.shopName,
        {
          userId: auth.userId,
          role: auth.role,
        },
        (req.validatedQuery ?? req.query) as never,
      );

      res.setHeader("Content-Type", exportResult.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportResult.fileName}"`,
      );

      return res.status(200).send(exportResult.buffer);
    } catch (error) {
      return next(error);
    }
  };

  getStockReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = getAuthContext(req);
      const result = await this.reportsService.getStockReport(
        auth.shopId,
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  exportStockReport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const auth = getAuthContext(req);
      const exportResult = await this.reportsService.exportStockReport(
        auth.shopId,
        auth.shopName,
        (req.validatedQuery ?? req.query) as never,
      );

      res.setHeader("Content-Type", exportResult.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportResult.fileName}"`,
      );

      return res.status(200).send(exportResult.buffer);
    } catch (error) {
      return next(error);
    }
  };

  getLowStockReport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const auth = getAuthContext(req);
      const result = await this.reportsService.getLowStockReport(
        auth.shopId,
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  exportLowStockReport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const auth = getAuthContext(req);
      const exportResult = await this.reportsService.exportLowStockReport(
        auth.shopId,
        auth.shopName,
        (req.validatedQuery ?? req.query) as never,
      );

      res.setHeader("Content-Type", exportResult.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportResult.fileName}"`,
      );

      return res.status(200).send(exportResult.buffer);
    } catch (error) {
      return next(error);
    }
  };

  getExpiryReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = getAuthContext(req);
      const result = await this.reportsService.getExpiryReport(
        auth.shopId,
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  exportExpiryReport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const auth = getAuthContext(req);
      const exportResult = await this.reportsService.exportExpiryReport(
        auth.shopId,
        auth.shopName,
        (req.validatedQuery ?? req.query) as never,
      );

      res.setHeader("Content-Type", exportResult.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportResult.fileName}"`,
      );

      return res.status(200).send(exportResult.buffer);
    } catch (error) {
      return next(error);
    }
  };

  getSupplierReport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const auth = getAuthContext(req);
      const result = await this.reportsService.getSupplierReport(
        auth.shopId,
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  exportSupplierReport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const auth = getAuthContext(req);
      const exportResult = await this.reportsService.exportSupplierReport(
        auth.shopId,
        auth.shopName,
        (req.validatedQuery ?? req.query) as never,
      );

      res.setHeader("Content-Type", exportResult.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportResult.fileName}"`,
      );

      return res.status(200).send(exportResult.buffer);
    } catch (error) {
      return next(error);
    }
  };
}
