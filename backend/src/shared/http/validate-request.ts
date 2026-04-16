import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

export const validateRequest =
  (schema: ZodTypeAny): RequestHandler =>
  async (req, _res, next) => {
    try {
      const result = (await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      })) as {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };

      if (result.body) {
        req.body = result.body;
      }

      if (result.params) {
        req.params = result.params as typeof req.params;
      }

      if (result.query) {
        req.query = result.query as typeof req.query;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
