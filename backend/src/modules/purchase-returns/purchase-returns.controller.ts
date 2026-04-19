import type { NextFunction, Request, Response } from "express";

import { PurchaseReturnsService } from "./purchase-returns.service";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;
const getUserId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).id;
const getRouteId = (req: Request) => req.params.id as string;
const getPurchaseId = (req: Request) => req.params.purchaseId as string;

export class PurchaseReturnsController {
  constructor(
    private readonly purchaseReturnsService = new PurchaseReturnsService(),
  ) {}

  listPurchaseReturns = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.purchaseReturnsService.listPurchaseReturns(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getPurchaseReturnById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.purchaseReturnsService.getPurchaseReturnById(
        getShopId(req),
        getRouteId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getReturnablePurchaseDetail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.purchaseReturnsService.getReturnablePurchaseDetail(
        getShopId(req),
        getPurchaseId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createDraftPurchaseReturn = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.purchaseReturnsService.createDraftPurchaseReturn(
        getShopId(req),
        getUserId(req),
        req.body,
      );

      return res.status(201).json({
        message: "Purchase return draft created successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateDraftPurchaseReturn = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.purchaseReturnsService.updateDraftPurchaseReturn(
        getShopId(req),
        getRouteId(req),
        req.body,
      );

      return res.status(200).json({
        message: "Purchase return draft updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  completePurchaseReturn = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.purchaseReturnsService.completePurchaseReturn(
        getShopId(req),
        getRouteId(req),
        getUserId(req),
      );

      return res.status(200).json({
        message: "Purchase return completed successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  cancelDraftPurchaseReturn = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.purchaseReturnsService.cancelDraftPurchaseReturn(
        getShopId(req),
        getRouteId(req),
      );

      return res.status(200).json({
        message: "Purchase return draft cancelled successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };
}
