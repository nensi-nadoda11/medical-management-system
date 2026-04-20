import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../shared/errors/app-error";
import { BranchesService } from "./branches.service";
import {
  createBranchSchema,
  updateBranchSchema,
  updateUserBranchAssignmentsSchema,
} from "./branches.validation";

const getRequestedBranchId = (req: Request) => {
  const headerValue = req.header("x-branch-id");
  return typeof headerValue === "string" && headerValue.length ? headerValue : undefined;
};

const getRequiredParam = (req: Request, paramName: string) => {
  const value = req.params[paramName];

  if (typeof value === "string" && value.length) {
    return value;
  }

  throw new AppError({
    statusCode: 400,
    code: "INVALID_ROUTE_PARAM",
    message: `Missing route parameter: ${paramName}.`,
  });
};

export class BranchesController {
  constructor(private readonly branchesService = new BranchesService()) {}

  listBranches = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.authenticatedUser ?? req.authSession!.user;
      const requestedBranchId = getRequestedBranchId(req);
      const result = await this.branchesService.listBranches(user.shopId, {
        userId: user.id,
        role: user.role,
        ...(requestedBranchId ? { requestedBranchId } : {}),
      });

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  createBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = req.authenticatedUser ?? req.authSession!.user;
      const payload = createBranchSchema.parse({ body: req.body }).body;
      const result = await this.branchesService.createBranch(
        actor.shopId,
        payload,
        actor,
      );

      return res.status(201).json({
        message: "Branch created successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateBranch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = req.authenticatedUser ?? req.authSession!.user;
      const parsed = updateBranchSchema.parse({
        params: req.params,
        body: req.body,
      });
      const result = await this.branchesService.updateBranch(
        actor.shopId,
        parsed.params.id,
        parsed.body,
        actor,
      );

      return res.status(200).json({
        message: "Branch updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };

  listUserBranchAssignments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const actor = req.authenticatedUser ?? req.authSession!.user;
      const result = await this.branchesService.listUserBranchAssignments(
        actor.shopId,
        getRequiredParam(req, "userId"),
      );

      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  };

  updateUserBranchAssignments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const actor = req.authenticatedUser ?? req.authSession!.user;
      const parsed = updateUserBranchAssignmentsSchema.parse({
        params: req.params,
        body: req.body,
      });
      const result = await this.branchesService.updateUserBranchAssignments(
        actor.shopId,
        parsed.params.userId,
        parsed.body,
        actor,
      );

      return res.status(200).json({
        message: "User branch assignments updated successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  };
}
