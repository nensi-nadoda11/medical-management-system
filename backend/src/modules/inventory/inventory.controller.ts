import type { NextFunction, Request, Response } from "express";

import { InventoryService } from "./inventory.service";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;
const getUserId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).id;

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
