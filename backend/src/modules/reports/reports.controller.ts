import type { NextFunction, Request, Response } from "express";

import { BranchesService } from "../branches/branches.service";
import { ReportsService } from "./reports.service";

const getAuthContext = (req: Request) => {
  const user = req.authenticatedUser ?? req.authSession!.user;
  const shop = req.authSession?.shop;

  return {
    shopId: user.shopId,
    branchId: req.authBranch!.id,
    userId: user.id,
    role: user.role,
    shopName: shop?.name ?? "Medical Management System",
  };
};

export class ReportsController {
  constructor(
    private readonly reportsService = new ReportsService(),
    private readonly branchesService = new BranchesService(),
  ) {}

  private async resolveBranchIds(
    req: Request,
    query: { branchId?: string; combineBranches?: boolean },
  ) {
    const session = req.authSession!;
    const requestedBranchId = query.combineBranches ? undefined : query.branchId;
    const branchContext = requestedBranchId
      ? await this.branchesService.resolveRequestBranchContext({
          shopId: session.user.shopId,
          userId: session.user.id,
          role: session.user.role,
          requestedBranchId,
        })
      : req.authBranchAccess!;

    return query.combineBranches
      ? branchContext.accessibleBranches.map((branch) => branch.id)
      : [branchContext.currentBranch.id];
  }

  getDashboardSummary = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const auth = getAuthContext(req);
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const result = await this.reportsService.getDashboardSummary(
        auth.shopId,
        branchIds,
        {
          userId: auth.userId,
          role: auth.role,
        },
        query as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getSalesReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = getAuthContext(req);
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const result = await this.reportsService.getSalesReport(
        auth.shopId,
        branchIds,
        {
          userId: auth.userId,
          role: auth.role,
        },
        query as never,
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
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const exportResult = await this.reportsService.exportSalesReport(
        auth.shopId,
        branchIds,
        auth.shopName,
        {
          userId: auth.userId,
          role: auth.role,
        },
        query as never,
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
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const result = await this.reportsService.getProfitReport(
        auth.shopId,
        branchIds,
        {
          userId: auth.userId,
          role: auth.role,
        },
        query as never,
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
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const exportResult = await this.reportsService.exportProfitReport(
        auth.shopId,
        branchIds,
        auth.shopName,
        {
          userId: auth.userId,
          role: auth.role,
        },
        query as never,
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
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const result = await this.reportsService.getStockReport(
        auth.shopId,
        branchIds,
        query as never,
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
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const exportResult = await this.reportsService.exportStockReport(
        auth.shopId,
        branchIds,
        auth.shopName,
        query as never,
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
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const result = await this.reportsService.getLowStockReport(
        auth.shopId,
        branchIds,
        query as never,
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
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const exportResult = await this.reportsService.exportLowStockReport(
        auth.shopId,
        branchIds,
        auth.shopName,
        query as never,
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
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const result = await this.reportsService.getExpiryReport(
        auth.shopId,
        branchIds,
        query as never,
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
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const exportResult = await this.reportsService.exportExpiryReport(
        auth.shopId,
        branchIds,
        auth.shopName,
        query as never,
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
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const result = await this.reportsService.getSupplierReport(
        auth.shopId,
        branchIds,
        query as never,
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
      const query = (req.validatedQuery ?? req.query) as {
        branchId?: string;
        combineBranches?: boolean;
      };
      const branchIds = await this.resolveBranchIds(req, query);
      const exportResult = await this.reportsService.exportSupplierReport(
        auth.shopId,
        branchIds,
        auth.shopName,
        query as never,
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
