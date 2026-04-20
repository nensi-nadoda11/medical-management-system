import type { NextFunction, Request, Response } from "express";

import { DataManagementService } from "./data-management.service";

const getAuthContext = (req: Request) => {
  const user = req.authenticatedUser ?? req.authSession!.user;
  const shop = req.authSession?.shop;

  return {
    id: user.id,
    shopId: user.shopId,
    role: user.role,
    fullName: user.fullName,
    shopName: shop?.name ?? "Medical Management System",
    shopSlug: shop?.slug,
  };
};

export class DataManagementController {
  constructor(
    private readonly dataManagementService = new DataManagementService(),
  ) {}

  downloadTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.dataManagementService.downloadTemplate(
        getAuthContext(req),
        (req.validatedQuery ?? req.query) as never,
      );

      res.setHeader("Content-Type", result.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );

      return res.status(200).send(result.buffer);
    } catch (error) {
      return next(error);
    }
  };

  validateImport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.dataManagementService.validateImport(
        getAuthContext(req),
        req.body,
      );

      return res.status(201).json({
        message: "Import preview generated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  confirmImport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.dataManagementService.confirmImport(
        getAuthContext(req),
        req.params.id as string,
      );

      return res.status(200).json({
        message: "Import completed successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  listImportJobs = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.dataManagementService.listImportJobs(
        getAuthContext(req).shopId,
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getImportJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.dataManagementService.getImportJobDetail(
        getAuthContext(req).shopId,
        req.params.id as string,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  exportDataset = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.dataManagementService.exportDataset(
        getAuthContext(req),
        (req.validatedQuery ?? req.query) as never,
      );

      res.setHeader("Content-Type", result.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );

      return res.status(200).send(result.buffer);
    } catch (error) {
      return next(error);
    }
  };

  createBackup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.dataManagementService.createBackup(
        getAuthContext(req),
        req.body,
      );

      return res.status(201).json({
        message: "Backup created successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  listBackups = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.dataManagementService.listBackups(
        getAuthContext(req).shopId,
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  downloadBackup = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.dataManagementService.downloadBackup(
        getAuthContext(req),
        req.params.id as string,
      );

      res.setHeader("Content-Type", result.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );

      return res.status(200).send(result.buffer);
    } catch (error) {
      return next(error);
    }
  };

  restoreBackup = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.dataManagementService.restoreBackup(
        getAuthContext(req),
        req.params.id as string,
        req.body,
      );

      return res.status(200).json({
        message: "Backup restored successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };
}
