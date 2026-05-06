import {
  moneyMinorUnitsToString,
  toMoneyMinorUnits,
} from "../../shared/utils/money";
import { buildSettlementState } from "../../shared/utils/financials";
import { AccountingRepository } from "./accounting.repository";
import type { DbExecutor } from "../../shared/db/executor";

const toDateValue = (value: Date | string) =>
  value instanceof Date ? value : new Date(value);

type LedgerSeedEntry = {
  transactionType:
    | "opening_balance"
    | "sale"
    | "sale_return"
    | "payment_received"
    | "purchase"
    | "purchase_return"
    | "payment_made";
  referenceType:
    | "opening_balance"
    | "sale"
    | "sale_return"
    | "customer_payment"
    | "supplier_payment"
    | "purchase"
    | "purchase_return";
  referenceId: string;
  debitMinorUnits: number;
  creditMinorUnits: number;
  entryDate: Date;
  createdAt: Date;
  notes: string;
  createdByUserId?: string | null;
};

export class AccountingLedgerService {
  constructor(private readonly accountingRepository = new AccountingRepository()) {}

  async applyAvailableCustomerAdvanceToSale(
    shopId: string,
    saleId: string,
    executor: DbExecutor,
  ) {
    const computation = await this.accountingRepository.getSalePaymentComputation(
      shopId,
      saleId,
      executor,
    );

    if (!computation || computation.sale.status !== "completed" || !computation.sale.customerId) {
      return 0;
    }

    await this.accountingRepository.lockCustomerPayments(
      computation.sale.customerId,
      executor,
    );

    const netReceivableMinorUnits = Math.max(
      toMoneyMinorUnits(computation.sale.grandTotal) -
        toMoneyMinorUnits(computation.returnedAmount),
      0,
    );
    const settlementState = buildSettlementState(
      netReceivableMinorUnits,
      toMoneyMinorUnits(computation.sale.initialPaidAmount) +
        toMoneyMinorUnits(computation.allocatedAmount),
    );
    let remainingDueMinorUnits = settlementState.dueMinorUnits;

    if (remainingDueMinorUnits <= 0) {
      return 0;
    }

    const advanceSources =
      await this.accountingRepository.listCustomerAdvancePaymentSources(
        shopId,
        computation.sale.customerId,
        executor,
      );

    const allocations: Array<{
      customerPaymentId: string;
      amountMinorUnits: number;
    }> = [];

    for (const source of advanceSources) {
      if (remainingDueMinorUnits <= 0) {
        break;
      }

      const availableMinorUnits = toMoneyMinorUnits(source.remainingAmount);
      const appliedMinorUnits = Math.min(
        availableMinorUnits,
        remainingDueMinorUnits,
      );

      if (appliedMinorUnits <= 0) {
        continue;
      }

      allocations.push({
        customerPaymentId: source.payment.id,
        amountMinorUnits: appliedMinorUnits,
      });
      remainingDueMinorUnits -= appliedMinorUnits;
    }

    if (!allocations.length) {
      return 0;
    }

    await this.accountingRepository.createCustomerPaymentAllocations(
      allocations.map((allocation) => ({
        shopId,
        customerPaymentId: allocation.customerPaymentId,
        customerId: computation.sale.customerId!,
        saleId,
        amount: moneyMinorUnitsToString(allocation.amountMinorUnits),
      })),
      executor,
    );

    return allocations.reduce(
      (sum, allocation) => sum + allocation.amountMinorUnits,
      0,
    );
  }

  async applyAvailableSupplierAdvanceToPurchase(
    shopId: string,
    purchaseId: string,
    executor: DbExecutor,
  ) {
    const computation = await this.accountingRepository.getPurchasePaymentComputation(
      shopId,
      purchaseId,
      executor,
    );

    if (!computation || computation.purchase.status !== "finalized") {
      return 0;
    }

    await this.accountingRepository.lockSupplierPayments(
      computation.purchase.supplierId,
      executor,
    );

    const netPayableMinorUnits = Math.max(
      toMoneyMinorUnits(computation.purchase.grandTotal) -
        toMoneyMinorUnits(computation.returnedAmount),
      0,
    );
    const settlementState = buildSettlementState(
      netPayableMinorUnits,
      toMoneyMinorUnits(computation.purchase.initialPaidAmount) +
        toMoneyMinorUnits(computation.allocatedAmount),
    );
    let remainingDueMinorUnits = settlementState.dueMinorUnits;

    if (remainingDueMinorUnits <= 0) {
      return 0;
    }

    const advanceSources =
      await this.accountingRepository.listSupplierAdvancePaymentSources(
        shopId,
        computation.purchase.supplierId,
        executor,
      );

    const allocations: Array<{
      supplierPaymentId: string;
      amountMinorUnits: number;
    }> = [];

    for (const source of advanceSources) {
      if (remainingDueMinorUnits <= 0) {
        break;
      }

      const availableMinorUnits = toMoneyMinorUnits(source.remainingAmount);
      const appliedMinorUnits = Math.min(
        availableMinorUnits,
        remainingDueMinorUnits,
      );

      if (appliedMinorUnits <= 0) {
        continue;
      }

      allocations.push({
        supplierPaymentId: source.payment.id,
        amountMinorUnits: appliedMinorUnits,
      });
      remainingDueMinorUnits -= appliedMinorUnits;
    }

    if (!allocations.length) {
      return 0;
    }

    await this.accountingRepository.createSupplierPaymentAllocations(
      allocations.map((allocation) => ({
        shopId,
        supplierPaymentId: allocation.supplierPaymentId,
        supplierId: computation.purchase.supplierId,
        purchaseId,
        amount: moneyMinorUnitsToString(allocation.amountMinorUnits),
      })),
      executor,
    );

    return allocations.reduce(
      (sum, allocation) => sum + allocation.amountMinorUnits,
      0,
    );
  }

  async syncCustomerSaleFinancials(
    shopId: string,
    saleId: string,
    updatedByUserId: string,
    executor: DbExecutor,
  ) {
    const computation = await this.accountingRepository.getSalePaymentComputation(
      shopId,
      saleId,
      executor,
    );

    if (!computation || computation.sale.status !== "completed") {
      return null;
    }

    const netReceivableMinorUnits = Math.max(
      toMoneyMinorUnits(computation.sale.grandTotal) -
        toMoneyMinorUnits(computation.returnedAmount),
      0,
    );
    const settlementState = buildSettlementState(
      netReceivableMinorUnits,
      toMoneyMinorUnits(computation.sale.initialPaidAmount) +
        toMoneyMinorUnits(computation.allocatedAmount),
    );

    await this.accountingRepository.updateSaleFinancials(
      saleId,
      {
        paidAmount: moneyMinorUnitsToString(settlementState.settledMinorUnits),
        dueAmount: moneyMinorUnitsToString(settlementState.dueMinorUnits),
        paymentStatus: settlementState.paymentStatus,
        updatedByUserId,
      },
      executor,
    );

    if (computation.sale.customerId) {
      await this.rebuildCustomerLedger(shopId, computation.sale.customerId, executor);
    }

    return computation.sale;
  }

  async syncSupplierPurchaseFinancials(
    shopId: string,
    purchaseId: string,
    updatedByUserId: string,
    executor: DbExecutor,
  ) {
    const computation = await this.accountingRepository.getPurchasePaymentComputation(
      shopId,
      purchaseId,
      executor,
    );

    if (!computation || computation.purchase.status !== "finalized") {
      return null;
    }

    const netPayableMinorUnits = Math.max(
      toMoneyMinorUnits(computation.purchase.grandTotal) -
        toMoneyMinorUnits(computation.returnedAmount),
      0,
    );
    const settlementState = buildSettlementState(
      netPayableMinorUnits,
      toMoneyMinorUnits(computation.purchase.initialPaidAmount) +
        toMoneyMinorUnits(computation.allocatedAmount),
    );

    await this.accountingRepository.updatePurchaseFinancials(
      purchaseId,
      {
        paidAmount: moneyMinorUnitsToString(settlementState.settledMinorUnits),
        dueAmount: moneyMinorUnitsToString(settlementState.dueMinorUnits),
        paymentStatus: settlementState.paymentStatus,
        updatedByUserId,
      },
      executor,
    );

    await this.rebuildSupplierLedger(shopId, computation.purchase.supplierId, executor);

    return computation.purchase;
  }

  async rebuildCustomerLedger(
    shopId: string,
    customerId: string,
    executor: DbExecutor,
  ) {
    const source = await this.accountingRepository.listCustomerLedgerSources(
      shopId,
      customerId,
      executor,
    );
    const ledgerSeedEntries: LedgerSeedEntry[] = [];

    for (const sale of source.sales) {
      ledgerSeedEntries.push({
        transactionType: "sale",
        referenceType: "sale",
        referenceId: sale.id,
        debitMinorUnits: toMoneyMinorUnits(sale.amount),
        creditMinorUnits: 0,
        entryDate: sale.entryDate,
        createdAt: sale.createdAt,
        notes: `Sale ${sale.billNumber}`,
        createdByUserId: sale.createdByUserId,
      });

      const initialPaidMinorUnits = toMoneyMinorUnits(sale.initialPaidAmount);

      if (initialPaidMinorUnits > 0) {
        ledgerSeedEntries.push({
          transactionType: "payment_received",
          referenceType: "sale",
          referenceId: sale.id,
          debitMinorUnits: 0,
          creditMinorUnits: initialPaidMinorUnits,
          entryDate: sale.entryDate,
          createdAt: sale.createdAt,
          notes: `Initial payment on ${sale.billNumber}`,
          createdByUserId: sale.createdByUserId,
        });
      }
    }

    for (const saleReturn of source.returns) {
      ledgerSeedEntries.push({
        transactionType: "sale_return",
        referenceType: "sale_return",
        referenceId: saleReturn.id,
        debitMinorUnits: 0,
        creditMinorUnits: toMoneyMinorUnits(saleReturn.amount),
        entryDate: saleReturn.entryDate,
        createdAt: saleReturn.createdAt,
        notes: `Sales return ${saleReturn.returnNumber}`,
        createdByUserId: saleReturn.createdByUserId,
      });
    }

    for (const payment of source.payments) {
      ledgerSeedEntries.push({
        transactionType: "payment_received",
        referenceType: "customer_payment",
        referenceId: payment.id,
        debitMinorUnits: 0,
        creditMinorUnits: toMoneyMinorUnits(payment.amount),
        entryDate: payment.entryDate,
        createdAt: payment.createdAt,
        notes: `Payment received via ${payment.paymentMethod}`,
        createdByUserId: payment.createdByUserId,
      });
    }

    return this.replaceLedgerEntries(
      shopId,
      "customer",
      customerId,
      ledgerSeedEntries,
      executor,
    );
  }

  async rebuildSupplierLedger(
    shopId: string,
    supplierId: string,
    executor: DbExecutor,
  ) {
    const source = await this.accountingRepository.listSupplierLedgerSources(
      shopId,
      supplierId,
      executor,
    );
    const ledgerSeedEntries: LedgerSeedEntry[] = [];

    if (source.supplier) {
      const openingBalanceMinorUnits = toMoneyMinorUnits(source.supplier.openingBalance);

      if (openingBalanceMinorUnits !== 0) {
        ledgerSeedEntries.push({
          transactionType: "opening_balance",
          referenceType: "opening_balance",
          referenceId: source.supplier.id,
          debitMinorUnits: openingBalanceMinorUnits < 0 ? Math.abs(openingBalanceMinorUnits) : 0,
          creditMinorUnits: openingBalanceMinorUnits > 0 ? openingBalanceMinorUnits : 0,
          entryDate: source.supplier.createdAt,
          createdAt: source.supplier.createdAt,
          notes: "Supplier opening balance",
          createdByUserId: null,
        });
      }
    }

    for (const purchase of source.purchases) {
      ledgerSeedEntries.push({
        transactionType: "purchase",
        referenceType: "purchase",
        referenceId: purchase.id,
        debitMinorUnits: 0,
        creditMinorUnits: toMoneyMinorUnits(purchase.amount),
        entryDate: purchase.entryDate,
        createdAt: purchase.createdAt,
        notes: `Purchase ${purchase.purchaseNumber}`,
        createdByUserId: purchase.createdByUserId,
      });

      const initialPaidMinorUnits = toMoneyMinorUnits(purchase.initialPaidAmount);

      if (initialPaidMinorUnits > 0) {
        ledgerSeedEntries.push({
          transactionType: "payment_made",
          referenceType: "purchase",
          referenceId: purchase.id,
          debitMinorUnits: initialPaidMinorUnits,
          creditMinorUnits: 0,
          entryDate: purchase.entryDate,
          createdAt: purchase.createdAt,
          notes: `Initial payment on ${purchase.purchaseNumber}`,
          createdByUserId: purchase.createdByUserId,
        });
      }
    }

    for (const purchaseReturn of source.returns) {
      ledgerSeedEntries.push({
        transactionType: "purchase_return",
        referenceType: "purchase_return",
        referenceId: purchaseReturn.id,
        debitMinorUnits: toMoneyMinorUnits(purchaseReturn.amount),
        creditMinorUnits: 0,
        entryDate: purchaseReturn.entryDate,
        createdAt: purchaseReturn.createdAt,
        notes: `Purchase return ${purchaseReturn.returnNumber}`,
        createdByUserId: purchaseReturn.createdByUserId,
      });
    }

    for (const payment of source.payments) {
      ledgerSeedEntries.push({
        transactionType: "payment_made",
        referenceType: "supplier_payment",
        referenceId: payment.id,
        debitMinorUnits: toMoneyMinorUnits(payment.amount),
        creditMinorUnits: 0,
        entryDate: payment.entryDate,
        createdAt: payment.createdAt,
        notes: `Payment made via ${payment.paymentMethod}`,
        createdByUserId: payment.createdByUserId,
      });
    }

    return this.replaceLedgerEntries(
      shopId,
      "supplier",
      supplierId,
      ledgerSeedEntries,
      executor,
    );
  }

  private async replaceLedgerEntries(
    shopId: string,
    entityType: "customer" | "supplier",
    entityId: string,
    entries: LedgerSeedEntry[],
    executor: DbExecutor,
  ) {
    const normalizedEntries = entries.map((entry) => ({
      ...entry,
      entryDate: toDateValue(entry.entryDate),
      createdAt: toDateValue(entry.createdAt),
    }));

    const sortedEntries = [...normalizedEntries].sort((left, right) => {
      const entryDateDelta = left.entryDate.getTime() - right.entryDate.getTime();

      if (entryDateDelta !== 0) {
        return entryDateDelta;
      }

      const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime();

      if (createdAtDelta !== 0) {
        return createdAtDelta;
      }

      return `${left.referenceType}:${left.referenceId}`.localeCompare(
        `${right.referenceType}:${right.referenceId}`,
      );
    });

    let runningMinorUnits = 0;

    return this.accountingRepository.replaceLedgerEntries(
      shopId,
      entityType,
      entityId,
      sortedEntries.map((entry) => {
        runningMinorUnits =
          entityType === "customer"
            ? runningMinorUnits + entry.debitMinorUnits - entry.creditMinorUnits
            : runningMinorUnits + entry.creditMinorUnits - entry.debitMinorUnits;

        return {
          shopId,
          entityType,
          entityId,
          transactionType: entry.transactionType,
          debit: moneyMinorUnitsToString(entry.debitMinorUnits),
          credit: moneyMinorUnitsToString(entry.creditMinorUnits),
          balanceAfter: moneyMinorUnitsToString(runningMinorUnits),
          entryDate: entry.entryDate,
          referenceType: entry.referenceType,
          referenceId: entry.referenceId,
          notes: entry.notes,
          createdByUserId: entry.createdByUserId ?? undefined,
          createdAt: entry.createdAt,
        };
      }),
      executor,
    );
  }

  async deletePurchaseFinancials(shopId: string, purchaseId: string, executor: DbExecutor) {
    // Find the purchase to get supplierId before it's deleted
    const computation = await this.accountingRepository.getPurchasePaymentComputation(
      shopId,
      purchaseId,
      executor,
    );

    if (!computation) {
      return;
    }

    // After deleting the purchase (handled by the caller), we rebuild the supplier ledger
    // We should probably do this AFTER the deletion is committed, or inside the same transaction
    // listSupplierLedgerSources should not include the deleted purchase.
    await this.rebuildSupplierLedger(shopId, computation.purchase.supplierId, executor);
  }
}
