import type { NextFunction, Request, Response } from "express";

import { InventoryService } from "./inventory.service";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;
const getUserId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).id;
const getBranchId = (req: Request) => req.authBranch!.id;

export class InventoryController {
  constructor(private readonly inventoryService = new InventoryService()) {}

  listInventorySummary = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.inventoryService.listInventorySummary(
        getShopId(req),
        getBranchId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getInventoryMedicineDetail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.inventoryService.getInventoryMedicineDetail(
        getShopId(req),
        getBranchId(req),
        req.params.medicineId as string,
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  listStockTransactions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.inventoryService.listStockTransactions(
        getShopId(req),
        getBranchId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  listLowStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.inventoryService.listLowStock(
        getShopId(req),
        getBranchId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  listExpiryReport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.inventoryService.listExpiryReport(
        getShopId(req),
        getBranchId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createStockAdjustment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.inventoryService.createStockAdjustment(
        getShopId(req),
        getBranchId(req),
        getUserId(req),
        req.body,
      );

      return res.status(201).json({
        message: "Stock adjustment created successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };
}
