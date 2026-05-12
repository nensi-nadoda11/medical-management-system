import type { NextFunction, Request, Response } from "express";

import { AccountingService } from "../accounting/accounting.service";
import { CustomersService } from "./customers.service";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;
const getUserId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).id;
const getRouteId = (req: Request) => req.params.id as string;

export class CustomersController {
  constructor(
    private readonly customersService = new CustomersService(),
    private readonly accountingService = new AccountingService(),
  ) {}

  listCustomers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.customersService.listCustomers(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  listCustomerOptions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.customersService.listCustomerOptions(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  listCustomerDueSummaries = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.customersService.listCustomerDueSummaries(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getCustomerById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.customersService.getCustomerById(
        getShopId(req),
        getRouteId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.customersService.createCustomer(
        getShopId(req),
        req.body,
      );

      return res.status(201).json({
        message: "Customer created successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.customersService.updateCustomer(
        getShopId(req),
        getRouteId(req),
        req.body,
      );

      return res.status(200).json({
        message: "Customer updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateCustomerStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.customersService.updateCustomerStatus(
        getShopId(req),
        getRouteId(req),
        req.body,
      );

      return res.status(200).json({
        message: "Customer status updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  deleteCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.customersService.deleteCustomer(
        getShopId(req),
        getRouteId(req),
      );

      return res.status(200).json({
        message: "Customer deleted successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  listCustomerPurchases = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.customersService.listCustomerPurchases(
        getShopId(req),
        getRouteId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  listCustomerPayments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.customersService.listCustomerPayments(
        getShopId(req),
        getRouteId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createCustomerPayment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.accountingService.createCustomerPayment(
        getShopId(req),
        getUserId(req),
        {
          ...req.body,
          customerId: getRouteId(req),
        },
      );

      return res.status(201).json({
        message: "Customer payment recorded successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };
}
