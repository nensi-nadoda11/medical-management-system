import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env";
import { healthRoutes } from "./modules/health/health.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { AppError } from "./shared/errors/app-error";
import { errorHandler, notFoundHandler } from "./shared/errors/error-handler";
import { shopRoutes } from "./modules/shop/shop.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { medicinesRoutes } from "./modules/medicines/medicines.routes";
import { suppliersRoutes } from "./modules/suppliers/suppliers.routes";
import { purchasesRoutes } from "./modules/purchases/purchases.routes";
import { inventoryRoutes } from "./modules/inventory/inventory.routes";

export const app = express();

app.set("trust proxy", env.TRUST_PROXY);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new AppError({
          statusCode: 403,
          code: "CORS_NOT_ALLOWED",
          message: "This origin is not allowed to access the API.",
        }),
      );
    },
    credentials: true,
  }),
);
app.use(helmet());
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: "medical-management-system-api",
      status: "ok",
    },
  });
});

app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/shop", shopRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/medicines", medicinesRoutes);
app.use("/api/v1/suppliers", suppliersRoutes);
app.use("/api/v1/purchases", purchasesRoutes);
app.use("/api/v1/inventory", inventoryRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
