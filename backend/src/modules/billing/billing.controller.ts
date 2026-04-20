import type { NextFunction, Request, Response } from "express";

import { BillingService } from "./billing.service";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;
const getUserId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).id;
const getRouteId = (req: Request) => req.params.id as string;
const getMedicineId = (req: Request) => req.params.medicineId as string;
const getBranchId = (req: Request) => req.authBranch!.id;

export class BillingController {
  constructor(private readonly billingService = new BillingService()) {}

  listBills = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.billingService.listBills(
        getShopId(req),
        getBranchId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getBillById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.billingService.getBillById(
        getShopId(req),
        getBranchId(req),
        getRouteId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createHeldBill = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.billingService.createHeldBill(
        getShopId(req),
        getBranchId(req),
        getUserId(req),
        req.body,
      );

      return res.status(201).json({
        message: "Bill saved to hold successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateHeldBill = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.billingService.updateHeldBill(
        getShopId(req),
        getBranchId(req),
        getRouteId(req),
        getUserId(req),
        req.body,
      );

      return res.status(200).json({
        message: "Held bill updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  createCompletedBill = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.billingService.createCompletedBill(
        getShopId(req),
        getBranchId(req),
        getUserId(req),
        req.body,
      );

      return res.status(201).json({
        message: "Bill completed successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  completeHeldBill = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.billingService.completeHeldBill(
        getShopId(req),
        getBranchId(req),
        getRouteId(req),
        getUserId(req),
      );

      return res.status(200).json({
        message: "Held bill completed successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  searchSellableMedicines = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.billingService.searchSellableMedicines(
        getShopId(req),
        getBranchId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getSellableMedicineOptions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.billingService.getSellableMedicineOptions(
        getShopId(req),
        getBranchId(req),
        getMedicineId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };
}
