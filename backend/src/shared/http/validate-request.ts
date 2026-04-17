import type { Request } from "express";
import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

const setRequestValue = (
  req: Request,
  key: "body" | "params" | "query",
  value: unknown,
) => {
  Object.defineProperty(req, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
};

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

      if (result.body !== undefined) {
        setRequestValue(req, "body", result.body);
      }

      if (result.params !== undefined) {
        setRequestValue(req, "params", result.params);
      }

      if (result.query !== undefined) {
        req.validatedQuery = result.query;
        setRequestValue(req, "query", result.query);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
