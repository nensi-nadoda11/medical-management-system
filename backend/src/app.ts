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
import { purchaseReturnsRoutes } from "./modules/purchase-returns/purchase-returns.routes";
import { inventoryRoutes } from "./modules/inventory/inventory.routes";
import { billingRoutes } from "./modules/billing/billing.routes";
import { reportsRoutes } from "./modules/reports/reports.routes";
import { adminSettingsRoutes } from "./modules/admin-settings/admin-settings.routes";
import { customersRoutes } from "./modules/customers/customers.routes";
import { salesReturnsRoutes } from "./modules/sales-returns/sales-returns.routes";
import { accountingRoutes } from "./modules/accounting/accounting.routes";
import { notificationsRoutes } from "./modules/notifications/notifications.routes";
import { auditLogsRoutes } from "./modules/audit-logs/audit-logs.routes";
import { documentsRoutes } from "./modules/documents/documents.routes";
import { dataManagementRoutes } from "./modules/data-management/data-management.routes";
import { branchesRoutes } from "./modules/branches/branches.routes";
import { stockTransfersRoutes } from "./modules/stock-transfers/stock-transfers.routes";
import { realtimeRoutes } from "./modules/realtime/realtime.routes";

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
app.use(express.json({ limit: "8mb" }));
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
app.use("/api/v1/customers", customersRoutes);
app.use("/api/v1/purchases", purchasesRoutes);
app.use("/api/v1/purchase-returns", purchaseReturnsRoutes);
app.use("/api/v1/inventory", inventoryRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/sales-returns", salesReturnsRoutes);
app.use("/api/v1/accounting", accountingRoutes);
app.use("/api/v1/reports", reportsRoutes);
app.use("/api/v1/admin-settings", adminSettingsRoutes);
app.use("/api/v1/notifications", notificationsRoutes);
app.use("/api/v1/audit-logs", auditLogsRoutes);
app.use("/api/v1/documents", documentsRoutes);
app.use("/api/v1/data-management", dataManagementRoutes);
app.use("/api/v1/branches", branchesRoutes);
app.use("/api/v1/stock-transfers", stockTransfersRoutes);
app.use("/api/v1/realtime", realtimeRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
