import type { DbExecutor, TransactionExecutor } from "./executor";

const isTransactionExecutor = (executor?: DbExecutor): executor is TransactionExecutor =>
  Boolean(executor && "rollback" in executor && typeof executor.rollback === "function");

type AsyncTaskResults<T extends readonly unknown[]> = {
  [K in keyof T]: () => Promise<T[K]>;
};

export const runDbReads = async <T extends readonly unknown[]>(
  tasks: AsyncTaskResults<T>,
  executor?: DbExecutor,
): Promise<T> => {
  if (!tasks.length) {
    return [] as unknown as T;
  }

  if (!isTransactionExecutor(executor)) {
    return Promise.all(tasks.map((task) => task())) as unknown as Promise<T>;
  }

  const results: unknown[] = [];

  for (const task of tasks) {
    results.push(await task());
  }

  return results as unknown as T;
};
