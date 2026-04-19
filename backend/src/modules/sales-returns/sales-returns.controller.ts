import type { NextFunction, Request, Response } from "express";

import { SalesReturnsService } from "./sales-returns.service";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;
const getUserId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).id;
const getUserRole = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).role;
const getRouteId = (req: Request) => req.params.id as string;
const getSaleId = (req: Request) => req.params.saleId as string;

export class SalesReturnsController {
  constructor(private readonly salesReturnsService = new SalesReturnsService()) {}

  listSalesReturns = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.salesReturnsService.listSalesReturns(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getSalesReturnById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.salesReturnsService.getSalesReturnById(
        getShopId(req),
        getRouteId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getReturnableSaleDetail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.salesReturnsService.getReturnableSaleDetail(
        getShopId(req),
        getSaleId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createDraftSalesReturn = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.salesReturnsService.createDraftSalesReturn(
        getShopId(req),
        getUserId(req),
        getUserRole(req),
        req.body,
      );

      return res.status(201).json({
        message: "Sales return draft created successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateDraftSalesReturn = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.salesReturnsService.updateDraftSalesReturn(
        getShopId(req),
        getRouteId(req),
        getUserRole(req),
        req.body,
      );

      return res.status(200).json({
        message: "Sales return draft updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  completeSalesReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.salesReturnsService.completeSalesReturn(
        getShopId(req),
        getRouteId(req),
        getUserId(req),
        getUserRole(req),
      );

      return res.status(200).json({
        message: "Sales return completed successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  cancelDraftSalesReturn = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.salesReturnsService.cancelDraftSalesReturn(
        getShopId(req),
        getRouteId(req),
        getUserRole(req),
      );

      return res.status(200).json({
        message: "Sales return draft cancelled successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };
}
