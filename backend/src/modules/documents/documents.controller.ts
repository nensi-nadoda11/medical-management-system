import type { NextFunction, Request, Response } from "express";

import { DocumentsService } from "./documents.service";
import type { DocumentRequestQuery } from "./documents.validation";

const getShopId = (req: Request) =>
  (req.authenticatedUser ?? req.authSession!.user).shopId;

const getRouteId = (req: Request) => req.params.id as string;

const getVariant = (req: Request) =>
  ((req.validatedQuery ?? req.query) as DocumentRequestQuery).variant ?? "a4";

export class DocumentsController {
  constructor(private readonly documentsService = new DocumentsService()) {}

  getSaleInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.documentsService.getSaleInvoiceDocument(
        getShopId(req),
        getRouteId(req),
        getVariant(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  downloadSaleInvoicePdf = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.documentsService.getSaleInvoicePdf(
        getShopId(req),
        getRouteId(req),
        getVariant(req),
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );

      return res.status(200).send(result.buffer);
    } catch (error) {
      return next(error);
    }
  };

  getPurchaseDocument = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.documentsService.getPurchaseDocument(
        getShopId(req),
        getRouteId(req),
        getVariant(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  downloadPurchasePdf = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.documentsService.getPurchasePdf(
        getShopId(req),
        getRouteId(req),
        getVariant(req),
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );

      return res.status(200).send(result.buffer);
    } catch (error) {
      return next(error);
    }
  };

  getSaleReturnNote = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.documentsService.getSaleReturnDocument(
        getShopId(req),
        getRouteId(req),
        getVariant(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  downloadSaleReturnPdf = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.documentsService.getSaleReturnPdf(
        getShopId(req),
        getRouteId(req),
        getVariant(req),
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );

      return res.status(200).send(result.buffer);
    } catch (error) {
      return next(error);
    }
  };

  getPurchaseReturnNote = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.documentsService.getPurchaseReturnDocument(
        getShopId(req),
        getRouteId(req),
        getVariant(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  downloadPurchaseReturnPdf = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.documentsService.getPurchaseReturnPdf(
        getShopId(req),
        getRouteId(req),
        getVariant(req),
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );

      return res.status(200).send(result.buffer);
    } catch (error) {
      return next(error);
    }
  };

  getCustomerPaymentReceipt = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.documentsService.getCustomerPaymentReceipt(
        getShopId(req),
        getRouteId(req),
        getVariant(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  downloadCustomerPaymentReceiptPdf = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.documentsService.getCustomerPaymentReceiptPdf(
        getShopId(req),
        getRouteId(req),
        getVariant(req),
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );

      return res.status(200).send(result.buffer);
    } catch (error) {
      return next(error);
    }
  };

  getSupplierPaymentReceipt = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.documentsService.getSupplierPaymentReceipt(
        getShopId(req),
        getRouteId(req),
        getVariant(req),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  downloadSupplierPaymentReceiptPdf = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.documentsService.getSupplierPaymentReceiptPdf(
        getShopId(req),
        getRouteId(req),
        getVariant(req),
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );

      return res.status(200).send(result.buffer);
    } catch (error) {
      return next(error);
    }
  };
}
