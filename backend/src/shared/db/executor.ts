import { db } from "../../db/client";

export type TransactionExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbExecutor = typeof db | TransactionExecutor;

export const getDbExecutor = (executor?: DbExecutor) => executor ?? db;
