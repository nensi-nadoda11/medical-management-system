import { and, asc, eq } from "drizzle-orm";

import {
  customerPaymentAllocations,
  customerPayments,
  customers,
  medicineBatches,
  medicines,
  purchaseItems,
  purchaseReturnItems,
  purchaseReturns,
  purchases,
  saleItems,
  saleReturnItems,
  saleReturns,
  sales,
  shops,
  supplierPaymentAllocations,
  supplierPayments,
  suppliers,
  users,
} from "../../db/schema";
import { getDbExecutor, type DbExecutor } from "../../shared/db/executor";

export class DocumentsRepository {
  async findShopBranding(shopId: string, executor?: DbExecutor) {
    const [shop] = await getDbExecutor(executor)
      .select({
        id: shops.id,
        name: shops.name,
        phone: shops.phone,
        email: shops.email,
        addressLine1: shops.addressLine1,
        addressLine2: shops.addressLine2,
        city: shops.city,
        state: shops.state,
        pincode: shops.pincode,
        gstNumber: shops.gstNumber,
        licenseNumber: shops.licenseNumber,
        invoicePrefix: shops.invoicePrefix,
      })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);

    return shop ?? null;
  }

  async findUserById(userId: string, executor?: DbExecutor) {
    const [user] = await getDbExecutor(executor)
      .select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ?? null;
  }

  async findSaleDocumentById(shopId: string, saleId: string, executor?: DbExecutor) {
    const database = getDbExecutor(executor);
    const [record] = await database
      .select({
        sale: sales,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(sales)
      .innerJoin(users, eq(sales.createdByUserId, users.id))
      .where(and(eq(sales.shopId, shopId), eq(sales.id, saleId)))
      .limit(1);

    if (!record) {
      return null;
    }

    const items = await database
      .select({
        item: saleItems,
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          form: medicines.form,
          unit: medicines.unit,
        },
        batch: {
          id: medicineBatches.id,
          batchNumber: medicineBatches.batchNumber,
          expiryDate: medicineBatches.expiryDate,
        },
      })
      .from(saleItems)
      .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(saleItems.batchId, medicineBatches.id))
      .where(and(eq(saleItems.shopId, shopId), eq(saleItems.saleId, saleId)))
      .orderBy(asc(saleItems.createdAt), asc(saleItems.id));

    return {
      ...record,
      items,
    };
  }

  async findPurchaseDocumentById(
    shopId: string,
    purchaseId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [record] = await database
      .select({
        purchase: purchases,
        supplier: {
          id: suppliers.id,
          supplierName: suppliers.supplierName,
          companyName: suppliers.companyName,
          contactPerson: suppliers.contactPerson,
          mobileNumber: suppliers.mobileNumber,
          email: suppliers.email,
          gstNumber: suppliers.gstNumber,
        },
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(purchases)
      .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .innerJoin(users, eq(purchases.createdByUserId, users.id))
      .where(and(eq(purchases.shopId, shopId), eq(purchases.id, purchaseId)))
      .limit(1);

    if (!record) {
      return null;
    }

    const items = await database
      .select({
        item: purchaseItems,
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          form: medicines.form,
          unit: medicines.unit,
        },
      })
      .from(purchaseItems)
      .innerJoin(medicines, eq(purchaseItems.medicineId, medicines.id))
      .where(
        and(eq(purchaseItems.shopId, shopId), eq(purchaseItems.purchaseId, purchaseId)),
      )
      .orderBy(asc(purchaseItems.createdAt), asc(purchaseItems.id));

    return {
      ...record,
      items,
    };
  }

  async findSaleReturnDocumentById(
    shopId: string,
    returnId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [record] = await database
      .select({
        saleReturn: saleReturns,
        sale: sales,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(saleReturns)
      .innerJoin(sales, eq(saleReturns.saleId, sales.id))
      .innerJoin(users, eq(saleReturns.createdByUserId, users.id))
      .where(and(eq(saleReturns.shopId, shopId), eq(saleReturns.id, returnId)))
      .limit(1);

    if (!record) {
      return null;
    }

    const items = await database
      .select({
        item: saleReturnItems,
        saleItem: saleItems,
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          form: medicines.form,
          unit: medicines.unit,
        },
        batch: {
          id: medicineBatches.id,
          batchNumber: medicineBatches.batchNumber,
          expiryDate: medicineBatches.expiryDate,
        },
      })
      .from(saleReturnItems)
      .innerJoin(saleItems, eq(saleReturnItems.saleItemId, saleItems.id))
      .innerJoin(medicines, eq(saleReturnItems.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(saleReturnItems.batchId, medicineBatches.id))
      .where(
        and(
          eq(saleReturnItems.shopId, shopId),
          eq(saleReturnItems.returnId, returnId),
        ),
      )
      .orderBy(asc(saleReturnItems.createdAt), asc(saleReturnItems.id));

    return {
      ...record,
      items,
    };
  }

  async findPurchaseReturnDocumentById(
    shopId: string,
    returnId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [record] = await database
      .select({
        purchaseReturn: purchaseReturns,
        purchase: purchases,
        supplier: {
          id: suppliers.id,
          supplierName: suppliers.supplierName,
          companyName: suppliers.companyName,
          contactPerson: suppliers.contactPerson,
          mobileNumber: suppliers.mobileNumber,
          email: suppliers.email,
          gstNumber: suppliers.gstNumber,
        },
        createdBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(purchaseReturns)
      .innerJoin(purchases, eq(purchaseReturns.purchaseId, purchases.id))
      .innerJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
      .innerJoin(users, eq(purchaseReturns.createdByUserId, users.id))
      .where(
        and(eq(purchaseReturns.shopId, shopId), eq(purchaseReturns.id, returnId)),
      )
      .limit(1);

    if (!record) {
      return null;
    }

    const items = await database
      .select({
        item: purchaseReturnItems,
        purchaseItem: purchaseItems,
        medicine: {
          id: medicines.id,
          medicineName: medicines.medicineName,
          genericName: medicines.genericName,
          form: medicines.form,
          unit: medicines.unit,
        },
        batch: {
          id: medicineBatches.id,
          batchNumber: medicineBatches.batchNumber,
          expiryDate: medicineBatches.expiryDate,
        },
      })
      .from(purchaseReturnItems)
      .innerJoin(purchaseItems, eq(purchaseReturnItems.purchaseItemId, purchaseItems.id))
      .innerJoin(medicines, eq(purchaseReturnItems.medicineId, medicines.id))
      .innerJoin(medicineBatches, eq(purchaseReturnItems.batchId, medicineBatches.id))
      .where(
        and(
          eq(purchaseReturnItems.shopId, shopId),
          eq(purchaseReturnItems.returnId, returnId),
        ),
      )
      .orderBy(asc(purchaseReturnItems.createdAt), asc(purchaseReturnItems.id));

    return {
      ...record,
      items,
    };
  }

  async findCustomerPaymentDocumentById(
    shopId: string,
    paymentId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [record] = await database
      .select({
        payment: customerPayments,
        customer: {
          id: customers.id,
          customerCode: customers.customerCode,
          fullName: customers.fullName,
          mobileNumber: customers.mobileNumber,
          email: customers.email,
        },
        linkedSale: {
          id: sales.id,
          billNumber: sales.billNumber,
          completedAt: sales.completedAt,
          grandTotal: sales.grandTotal,
          dueAmount: sales.dueAmount,
          paymentStatus: sales.paymentStatus,
        },
        receivedBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(customerPayments)
      .innerJoin(customers, eq(customerPayments.customerId, customers.id))
      .innerJoin(users, eq(customerPayments.receivedByUserId, users.id))
      .leftJoin(sales, eq(customerPayments.saleId, sales.id))
      .where(
        and(eq(customerPayments.shopId, shopId), eq(customerPayments.id, paymentId)),
      )
      .limit(1);

    if (!record) {
      return null;
    }

    const allocations = await database
      .select({
        allocation: customerPaymentAllocations,
        sale: {
          id: sales.id,
          billNumber: sales.billNumber,
          completedAt: sales.completedAt,
          grandTotal: sales.grandTotal,
          dueAmount: sales.dueAmount,
          paymentStatus: sales.paymentStatus,
        },
      })
      .from(customerPaymentAllocations)
      .innerJoin(sales, eq(customerPaymentAllocations.saleId, sales.id))
      .where(
        and(
          eq(customerPaymentAllocations.shopId, shopId),
          eq(customerPaymentAllocations.customerPaymentId, paymentId),
        ),
      )
      .orderBy(
        asc(customerPaymentAllocations.createdAt),
        asc(customerPaymentAllocations.id),
      );

    return {
      ...record,
      allocations,
    };
  }

  async findSupplierPaymentDocumentById(
    shopId: string,
    paymentId: string,
    executor?: DbExecutor,
  ) {
    const database = getDbExecutor(executor);
    const [record] = await database
      .select({
        payment: supplierPayments,
        supplier: {
          id: suppliers.id,
          supplierName: suppliers.supplierName,
          companyName: suppliers.companyName,
          contactPerson: suppliers.contactPerson,
          mobileNumber: suppliers.mobileNumber,
          email: suppliers.email,
          gstNumber: suppliers.gstNumber,
        },
        linkedPurchase: {
          id: purchases.id,
          purchaseNumber: purchases.purchaseNumber,
          purchaseDate: purchases.purchaseDate,
          grandTotal: purchases.grandTotal,
          dueAmount: purchases.dueAmount,
          paymentStatus: purchases.paymentStatus,
        },
        paidBy: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(supplierPayments)
      .innerJoin(suppliers, eq(supplierPayments.supplierId, suppliers.id))
      .innerJoin(users, eq(supplierPayments.paidByUserId, users.id))
      .leftJoin(purchases, eq(supplierPayments.purchaseId, purchases.id))
      .where(
        and(eq(supplierPayments.shopId, shopId), eq(supplierPayments.id, paymentId)),
      )
      .limit(1);

    if (!record) {
      return null;
    }

    const allocations = await database
      .select({
        allocation: supplierPaymentAllocations,
        purchase: {
          id: purchases.id,
          purchaseNumber: purchases.purchaseNumber,
          purchaseDate: purchases.purchaseDate,
          grandTotal: purchases.grandTotal,
          dueAmount: purchases.dueAmount,
          paymentStatus: purchases.paymentStatus,
        },
      })
      .from(supplierPaymentAllocations)
      .innerJoin(purchases, eq(supplierPaymentAllocations.purchaseId, purchases.id))
      .where(
        and(
          eq(supplierPaymentAllocations.shopId, shopId),
          eq(supplierPaymentAllocations.supplierPaymentId, paymentId),
        ),
      )
      .orderBy(
        asc(supplierPaymentAllocations.createdAt),
        asc(supplierPaymentAllocations.id),
      );

    return {
      ...record,
      allocations,
    };
  }
}
