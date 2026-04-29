import type { NextFunction, Request, Response } from "express";

import { PurchasesService } from "./purchases.service";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;
const getUserId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).id;
const getBranchId = (req: Request) => req.authBranch!.id;
const getRouteId = (req: Request) => req.params.id as string;

export class PurchasesController {
  constructor(private readonly purchasesService = new PurchasesService()) {}

  listPurchases = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.purchasesService.listPurchases(
        getShopId(req),
        getBranchId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getPurchaseById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.purchasesService.getPurchaseById(
        getShopId(req),
        getBranchId(req),
        getRouteId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createPurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.purchasesService.createPurchase(
        getShopId(req),
        getBranchId(req),
        getUserId(req),
        req.body,
      );

      return res.status(201).json({
        message: "Purchase created successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateDraftPurchase = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.purchasesService.updateDraftPurchase(
        getShopId(req),
        getBranchId(req),
        getRouteId(req),
        getUserId(req),
        req.body,
      );

      return res.status(200).json({
        message: "Purchase updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  finalizePurchase = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.purchasesService.finalizePurchase(
        getShopId(req),
        getBranchId(req),
        getRouteId(req),
        getUserId(req),
      );

      return res.status(200).json({
        message: "Purchase finalized successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  approvePurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.purchasesService.approvePurchaseOrder(
        getShopId(req),
        getBranchId(req),
        getRouteId(req),
        getUserId(req),
      );

      return res.status(200).json({
        message: "Purchase order approved successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  markPurchaseOrderSupplierNotified = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.purchasesService.markPurchaseOrderSupplierNotified(
        getShopId(req),
        getBranchId(req),
        getRouteId(req),
        getUserId(req),
      );

      return res.status(200).json({
        message: "Purchase order marked as shared with supplier successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  cancelPurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.purchasesService.cancelPurchase(
        getShopId(req),
        getBranchId(req),
        getRouteId(req),
        getUserId(req),
        req.body,
      );

      return res.status(200).json({
        message: "Purchase cancelled successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  deletePurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.purchasesService.deletePurchase(
        getShopId(req),
        getBranchId(req),
        getRouteId(req),
        getUserId(req),
      );

      return res.status(200).json({
        message: "Purchase deleted successfully.",
      });
    } catch (error) {
      return next(error);
    }
  };
}
