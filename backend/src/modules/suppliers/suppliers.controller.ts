import type { NextFunction, Request, Response } from "express";

import { SuppliersService } from "./suppliers.service";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;
const getRouteId = (req: Request) => req.params.id as string;

export class SuppliersController {
  constructor(private readonly suppliersService = new SuppliersService()) {}

  listSuppliers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.suppliersService.listSuppliers(
        getShopId(req),
        (req.validatedQuery ?? req.query) as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getSupplierById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.suppliersService.getSupplierById(
        getShopId(req),
        getRouteId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createSupplier = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.suppliersService.createSupplier(
        getShopId(req),
        req.body,
      );

      return res.status(201).json({
        message: "Supplier created successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.suppliersService.updateSupplier(
        getShopId(req),
        getRouteId(req),
        req.body,
      );

      return res.status(200).json({
        message: "Supplier updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateSupplierStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.suppliersService.updateSupplierStatus(
        getShopId(req),
        getRouteId(req),
        req.body,
      );

      return res.status(200).json({
        message: "Supplier status updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };
}
