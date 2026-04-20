import type { NextFunction, Request, Response } from "express";

import { StockTransfersService } from "./stock-transfers.service";
import {
  createStockTransferSchema,
  listSourceBatchesSchema,
  listStockTransfersSchema,
  transferIdSchema,
} from "./stock-transfers.validation";

export class StockTransfersController {
  constructor(private readonly stockTransfersService = new StockTransfersService()) {}

  listTransfers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.authenticatedUser ?? req.authSession!.user;
      const query = listStockTransfersSchema.parse({
        query: req.validatedQuery ?? req.query,
      }).query;
      const result = await this.stockTransfersService.listTransfers(user.shopId, query);

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  listSourceBatches = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.authenticatedUser ?? req.authSession!.user;
      const query = listSourceBatchesSchema.parse({
        query: req.validatedQuery ?? req.query,
      }).query;
      const result = await this.stockTransfersService.listAvailableSourceBatches(
        user.shopId,
        query,
        user,
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.authenticatedUser ?? req.authSession!.user;
      const body = createStockTransferSchema.parse({ body: req.body }).body;
      const result = await this.stockTransfersService.createTransfer(
        user.shopId,
        body,
        user,
      );

      return res.status(201).json({
        message: "Stock transfer created successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  completeTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.authenticatedUser ?? req.authSession!.user;
      const transferId = transferIdSchema.parse({ params: req.params }).params.id;
      const result = await this.stockTransfersService.completeTransfer(
        user.shopId,
        transferId,
        user,
      );

      return res.status(200).json({
        message: "Stock transfer completed successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  cancelTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.authenticatedUser ?? req.authSession!.user;
      const transferId = transferIdSchema.parse({ params: req.params }).params.id;
      const result = await this.stockTransfersService.cancelTransfer(
        user.shopId,
        transferId,
        user,
      );

      return res.status(200).json({
        message: "Stock transfer cancelled successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };
}
