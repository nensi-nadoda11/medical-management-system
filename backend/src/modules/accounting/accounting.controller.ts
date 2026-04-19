import type { NextFunction, Request, Response } from "express";

import { AccountingService } from "./accounting.service";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;
const getUserId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).id;
const getCustomerId = (req: Request) => req.params.customerId as string;
const getSupplierId = (req: Request) => req.params.supplierId as string;

export class AccountingController {
  constructor(private readonly accountingService = new AccountingService()) {}

  listCustomerPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.accountingService.listCustomerPayments(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createCustomerPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.accountingService.createCustomerPayment(
        getShopId(req),
        getUserId(req),
        req.body,
      );

      return res.status(201).json({
        message: "Customer payment recorded successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  getCustomerLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.accountingService.getCustomerLedger(
        getShopId(req),
        getCustomerId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getCustomerDueSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.accountingService.getCustomerDueSummary(
        getShopId(req),
        getCustomerId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  listOutstandingCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.accountingService.listOutstandingCustomers(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  listSupplierPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.accountingService.listSupplierPayments(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createSupplierPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.accountingService.createSupplierPayment(
        getShopId(req),
        getUserId(req),
        req.body,
      );

      return res.status(201).json({
        message: "Supplier payment recorded successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  getSupplierLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.accountingService.getSupplierLedger(
        getShopId(req),
        getSupplierId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getSupplierDueSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.accountingService.getSupplierDueSummary(
        getShopId(req),
        getSupplierId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  listOutstandingSuppliers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.accountingService.listOutstandingSuppliers(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  listSupplierOptions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = (req.validatedQuery ?? req.query) as {
        search?: string;
        pageSize: number;
      };
      const result = await this.accountingService.listSupplierOptions(
        getShopId(req),
        validated.search,
        validated.pageSize,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };
}
