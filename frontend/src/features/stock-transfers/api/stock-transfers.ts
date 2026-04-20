import { apiRequest } from "../../../lib/api";
import type {
  CreateStockTransferPayload,
  StockTransferListResponse,
  TransferBatchOption,
} from "../../../types/stock-transfer";

export const stockTransferQueryKeys = {
  all: ["stock-transfers"] as const,
  list: (page: number, pageSize: number) =>
    [...stockTransferQueryKeys.all, "list", page, pageSize] as const,
  sourceBatches: (branchId: string, search: string) =>
    [...stockTransferQueryKeys.all, "source-batches", branchId, search] as const,
};

export const getStockTransfers = (params: { page: number; pageSize: number }) =>
  apiRequest<StockTransferListResponse>({
    method: "GET",
    url: "/stock-transfers",
    params,
  });

export const getTransferSourceBatches = (params: {
  branchId: string;
  search?: string;
  pageSize?: number;
}) =>
  apiRequest<TransferBatchOption[]>({
    method: "GET",
    url: "/stock-transfers/source-batches",
    params,
  });

export const createStockTransfer = (payload: CreateStockTransferPayload) =>
  apiRequest<unknown>({
    method: "POST",
    url: "/stock-transfers",
    data: payload,
  });

export const completeStockTransfer = (transferId: string) =>
  apiRequest<unknown>({
    method: "POST",
    url: `/stock-transfers/${transferId}/complete`,
  });

export const cancelStockTransfer = (transferId: string) =>
  apiRequest<unknown>({
    method: "POST",
    url: `/stock-transfers/${transferId}/cancel`,
  });
