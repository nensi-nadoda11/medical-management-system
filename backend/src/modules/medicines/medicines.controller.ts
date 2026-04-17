import type { NextFunction, Request, Response } from "express";

import { MedicinesService } from "./medicines.service";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;
const getRouteId = (req: Request) => req.params.id as string;

export class MedicinesController {
  constructor(private readonly medicinesService = new MedicinesService()) {}

  listMedicines = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.medicinesService.listMedicines(
        getShopId(req),
        req.query as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  getMedicineById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.medicinesService.getMedicineById(
        getShopId(req),
        getRouteId(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createMedicine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.medicinesService.createMedicine(
        getShopId(req),
        req.body,
      );

      return res.status(201).json({
        message: "Medicine created successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateMedicine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.medicinesService.updateMedicine(
        getShopId(req),
        getRouteId(req),
        req.body,
      );

      return res.status(200).json({
        message: "Medicine updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateMedicineStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.medicinesService.updateMedicineStatus(
        getShopId(req),
        getRouteId(req),
        req.body,
      );

      return res.status(200).json({
        message: "Medicine status updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  listCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.medicinesService.listCategories(
        getShopId(req),
        req.query as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.medicinesService.createCategory(
        getShopId(req),
        req.body,
      );

      return res.status(201).json({
        message: "Category created successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.medicinesService.updateCategory(
        getShopId(req),
        getRouteId(req),
        req.body,
      );

      return res.status(200).json({
        message: "Category updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  listManufacturers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.medicinesService.listManufacturers(
        getShopId(req),
        req.query as never,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createManufacturer = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.medicinesService.createManufacturer(
        getShopId(req),
        req.body,
      );

      return res.status(201).json({
        message: "Manufacturer created successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateManufacturer = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.medicinesService.updateManufacturer(
        getShopId(req),
        getRouteId(req),
        req.body,
      );

      return res.status(200).json({
        message: "Manufacturer updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };
}
