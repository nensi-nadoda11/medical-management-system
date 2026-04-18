import {
  boolean,
  numeric,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "staff",
  "accountant",
]);
export const shopStatusEnum = pgEnum("shop_status", [
  "pending_verification",
  "active",
  "suspended",
]);
export const otpChannelEnum = pgEnum("otp_channel", ["email", "mobile"]);
export const otpPurposeEnum = pgEnum("otp_purpose", [
  "registration_verification",
]);
export const masterStatusEnum = pgEnum("master_status", ["active", "inactive"]);
export const medicineFormEnum = pgEnum("medicine_form", [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "ointment",
  "cream",
  "drops",
  "inhaler",
  "powder",
  "gel",
  "lotion",
  "solution",
  "suspension",
  "spray",
  "vial",
  "sachet",
  "other",
]);
export const medicineUnitEnum = pgEnum("medicine_unit", [
  "strip",
  "bottle",
  "piece",
  "box",
  "vial",
  "tube",
  "sachet",
  "ampoule",
  "packet",
  "kit",
  "container",
  "canister",
  "other",
]);
export const purchaseStatusEnum = pgEnum("purchase_status", [
  "draft",
  "finalized",
  "cancelled",
]);
export const purchasePaymentStatusEnum = pgEnum("purchase_payment_status", [
  "unpaid",
  "partial",
  "paid",
]);
export const batchStatusEnum = pgEnum("batch_status", [
  "active",
  "exhausted",
  "expired",
]);
export const stockTransactionTypeEnum = pgEnum("stock_transaction_type", [
  "purchase_in",
  "adjustment_in",
  "adjustment_out",
]);
export const stockReferenceTypeEnum = pgEnum("stock_reference_type", [
  "purchase_item",
  "stock_adjustment",
]);
export const stockAdjustmentTypeEnum = pgEnum("stock_adjustment_type", [
  "in",
  "out",
]);

export const shops = pgTable("shops", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  status: shopStatusEnum("status").notNull().default("pending_verification"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  addressLine1: varchar("address_line1", { length: 255 }),
  addressLine2: varchar("address_line2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  pincode: varchar("pincode", { length: 20 }),
  gstNumber: varchar("gst_number", { length: 50 }),
  licenseNumber: varchar("license_number", { length: 100 }),
  invoicePrefix: varchar("invoice_prefix", { length: 20 })
    .notNull()
    .default("INV"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "restrict" }),
    role: userRoleEnum("role").notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    mobileNumber: varchar("mobile_number", { length: 20 }),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    mobileVerifiedAt: timestamp("mobile_verified_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("users_shop_id_idx").on(table.shopId),
    roleIdx: index("users_role_idx").on(table.role),
    activeIdx: index("users_is_active_idx").on(table.isActive),
  }),
);

export const verificationOtps = pgTable(
  "verification_otps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: otpPurposeEnum("purpose").notNull(),
    channel: otpChannelEnum("channel").notNull(),
    target: varchar("target", { length: 320 }).notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    lookupIdx: index("verification_otps_lookup_idx").on(
      table.userId,
      table.purpose,
      table.channel,
      table.createdAt,
    ),
    expiryIdx: index("verification_otps_expiry_idx").on(table.expiresAt),
  }),
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("auth_sessions_user_id_idx").on(table.userId),
    expiryIdx: index("auth_sessions_expiry_idx").on(table.expiresAt),
  }),
);
export const userInvitations = pgTable(
  "user_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    role: userRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdUserId: uuid("created_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("user_invitations_shop_id_idx").on(table.shopId),
    emailIdx: index("user_invitations_email_idx").on(table.email),
    expiresAtIdx: index("user_invitations_expires_at_idx").on(table.expiresAt),
    invitedByIdx: index("user_invitations_invited_by_idx").on(
      table.invitedByUserId,
    ),
  }),
);

export const medicineCategories = pgTable(
  "medicine_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 120 }).notNull(),
    description: varchar("description", { length: 255 }),
    status: masterStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("medicine_categories_shop_id_idx").on(table.shopId),
    statusIdx: index("medicine_categories_status_idx").on(table.status),
    searchIdx: index("medicine_categories_normalized_name_idx").on(
      table.normalizedName,
    ),
    uniqueNameIdx: uniqueIndex("medicine_categories_shop_name_unique_idx").on(
      table.shopId,
      table.normalizedName,
    ),
  }),
);

export const manufacturers = pgTable(
  "manufacturers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 160 }).notNull(),
    status: masterStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("manufacturers_shop_id_idx").on(table.shopId),
    statusIdx: index("manufacturers_status_idx").on(table.status),
    searchIdx: index("manufacturers_normalized_name_idx").on(
      table.normalizedName,
    ),
    uniqueNameIdx: uniqueIndex("manufacturers_shop_name_unique_idx").on(
      table.shopId,
      table.normalizedName,
    ),
  }),
);

export const medicines = pgTable(
  "medicines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    medicineName: varchar("medicine_name", { length: 180 }).notNull(),
    medicineNameNormalized: varchar("medicine_name_normalized", {
      length: 180,
    }).notNull(),
    genericName: varchar("generic_name", { length: 180 }).notNull(),
    genericNameNormalized: varchar("generic_name_normalized", {
      length: 180,
    }).notNull(),
    brandName: varchar("brand_name", { length: 160 }),
    brandNameNormalized: varchar("brand_name_normalized", { length: 160 }),
    strength: varchar("strength", { length: 80 }),
    strengthNormalized: varchar("strength_normalized", { length: 80 })
      .notNull()
      .default(""),
    form: medicineFormEnum("form").notNull(),
    unit: medicineUnitEnum("unit").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => medicineCategories.id, { onDelete: "restrict" }),
    manufacturerId: uuid("manufacturer_id")
      .notNull()
      .references(() => manufacturers.id, { onDelete: "restrict" }),
    hsnCode: varchar("hsn_code", { length: 20 }),
    gstPercent: integer("gst_percent").notNull(),
    barcode: varchar("barcode", { length: 100 }),
    reorderLevel: integer("reorder_level").notNull().default(0),
    prescriptionRequired: boolean("prescription_required")
      .notNull()
      .default(false),
    notes: text("notes"),
    status: masterStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("medicines_shop_id_idx").on(table.shopId),
    categoryIdx: index("medicines_category_id_idx").on(table.categoryId),
    manufacturerIdx: index("medicines_manufacturer_id_idx").on(
      table.manufacturerId,
    ),
    statusIdx: index("medicines_status_idx").on(table.status),
    medicineSearchIdx: index("medicines_medicine_name_normalized_idx").on(
      table.medicineNameNormalized,
    ),
    genericSearchIdx: index("medicines_generic_name_normalized_idx").on(
      table.genericNameNormalized,
    ),
    barcodeIdx: index("medicines_barcode_idx").on(table.barcode),
    duplicateIdx: uniqueIndex("medicines_shop_duplicate_unique_idx").on(
      table.shopId,
      table.medicineNameNormalized,
      table.strengthNormalized,
      table.form,
      table.manufacturerId,
    ),
  }),
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    supplierName: varchar("supplier_name", { length: 180 }).notNull(),
    supplierNameNormalized: varchar("supplier_name_normalized", {
      length: 180,
    }).notNull(),
    companyName: varchar("company_name", { length: 180 }),
    companyNameNormalized: varchar("company_name_normalized", { length: 180 }),
    contactPerson: varchar("contact_person", { length: 160 }),
    mobileNumber: varchar("mobile_number", { length: 20 }).notNull(),
    alternateMobileNumber: varchar("alternate_mobile_number", { length: 20 }),
    email: varchar("email", { length: 320 }),
    gstNumber: varchar("gst_number", { length: 15 }),
    drugLicenseNumber: varchar("drug_license_number", { length: 100 }),
    addressLine1: varchar("address_line1", { length: 255 }),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    pincode: varchar("pincode", { length: 20 }),
    openingBalance: numeric("opening_balance", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0.00"),
    notes: text("notes"),
    status: masterStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("suppliers_shop_id_idx").on(table.shopId),
    statusIdx: index("suppliers_status_idx").on(table.status),
    supplierSearchIdx: index("suppliers_supplier_name_normalized_idx").on(
      table.supplierNameNormalized,
    ),
    mobileIdx: index("suppliers_mobile_number_idx").on(table.mobileNumber),
    emailIdx: index("suppliers_email_idx").on(table.email),
    gstIdx: index("suppliers_gst_number_idx").on(table.gstNumber),
    mobileUniqueIdx: uniqueIndex("suppliers_shop_mobile_unique_idx").on(
      table.shopId,
      table.mobileNumber,
    ),
  }),
);
export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    purchaseNumber: varchar("purchase_number", { length: 40 }).notNull(),
    purchaseNumberNormalized: varchar("purchase_number_normalized", {
      length: 40,
    }).notNull(),
    supplierInvoiceNumber: varchar("supplier_invoice_number", { length: 80 }),
    supplierInvoiceNumberNormalized: varchar(
      "supplier_invoice_number_normalized",
      { length: 80 },
    ),
    supplierInvoiceDate: timestamp("supplier_invoice_date", {
      withTimezone: true,
    }),
    purchaseDate: timestamp("purchase_date", { withTimezone: true }).notNull(),
    status: purchaseStatusEnum("status").notNull().default("draft"),
    paymentStatus: purchasePaymentStatusEnum("payment_status")
      .notNull()
      .default("unpaid"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    roundOffAmount: numeric("round_off_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    grandTotal: numeric("grand_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    paidAmount: numeric("paid_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    dueAmount: numeric("due_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("purchases_shop_id_idx").on(table.shopId),
    supplierIdIdx: index("purchases_supplier_id_idx").on(table.supplierId),
    purchaseDateIdx: index("purchases_purchase_date_idx").on(table.purchaseDate),
    statusIdx: index("purchases_status_idx").on(table.status),
    paymentStatusIdx: index("purchases_payment_status_idx").on(
      table.paymentStatus,
    ),
    purchaseNumberIdx: uniqueIndex("purchases_shop_purchase_number_unique_idx").on(
      table.shopId,
      table.purchaseNumberNormalized,
    ),
    supplierInvoiceIdx: uniqueIndex(
      "purchases_shop_supplier_invoice_unique_idx",
    ).on(table.shopId, table.supplierId, table.supplierInvoiceNumberNormalized),
  }),
);

export const medicineBatches = pgTable(
  "medicine_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    medicineId: uuid("medicine_id")
      .notNull()
      .references(() => medicines.id, { onDelete: "restrict" }),
    batchNumber: varchar("batch_number", { length: 80 }).notNull(),
    batchNumberNormalized: varchar("batch_number_normalized", {
      length: 80,
    }).notNull(),
    expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),
    purchaseRate: numeric("purchase_rate", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    saleRate: numeric("sale_rate", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    mrp: numeric("mrp", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    gstPercent: integer("gst_percent").notNull().default(0),
    quantityReceived: integer("quantity_received").notNull().default(0),
    quantityAvailable: integer("quantity_available").notNull().default(0),
    status: batchStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("medicine_batches_shop_id_idx").on(table.shopId),
    medicineIdIdx: index("medicine_batches_medicine_id_idx").on(table.medicineId),
    expiryDateIdx: index("medicine_batches_expiry_date_idx").on(table.expiryDate),
    statusIdx: index("medicine_batches_status_idx").on(table.status),
    uniqueBatchIdx: uniqueIndex("medicine_batches_shop_batch_unique_idx").on(
      table.shopId,
      table.medicineId,
      table.batchNumberNormalized,
      table.expiryDate,
    ),
  }),
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    medicineId: uuid("medicine_id")
      .notNull()
      .references(() => medicines.id, { onDelete: "restrict" }),
    medicineBatchId: uuid("medicine_batch_id").references(() => medicineBatches.id, {
      onDelete: "set null",
    }),
    batchNumber: varchar("batch_number", { length: 80 }).notNull(),
    batchNumberNormalized: varchar("batch_number_normalized", {
      length: 80,
    }).notNull(),
    expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),
    quantity: integer("quantity").notNull(),
    freeQuantity: integer("free_quantity").notNull().default(0),
    purchaseRate: numeric("purchase_rate", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    saleRate: numeric("sale_rate", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    mrp: numeric("mrp", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    gstPercent: integer("gst_percent").notNull().default(0),
    discountPercent: numeric("discount_percent", { precision: 7, scale: 2 })
      .notNull()
      .default("0.00"),
    lineSubtotal: numeric("line_subtotal", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    lineTaxAmount: numeric("line_tax_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("purchase_items_shop_id_idx").on(table.shopId),
    purchaseIdIdx: index("purchase_items_purchase_id_idx").on(table.purchaseId),
    medicineIdIdx: index("purchase_items_medicine_id_idx").on(table.medicineId),
    batchIdIdx: index("purchase_items_medicine_batch_id_idx").on(
      table.medicineBatchId,
    ),
    uniqueLineIdx: uniqueIndex("purchase_items_purchase_batch_unique_idx").on(
      table.purchaseId,
      table.medicineId,
      table.batchNumberNormalized,
      table.expiryDate,
    ),
  }),
);

export const stockAdjustments = pgTable(
  "stock_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    medicineId: uuid("medicine_id")
      .notNull()
      .references(() => medicines.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => medicineBatches.id, { onDelete: "restrict" }),
    adjustmentType: stockAdjustmentTypeEnum("adjustment_type").notNull(),
    quantity: integer("quantity").notNull(),
    reason: varchar("reason", { length: 160 }).notNull(),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("stock_adjustments_shop_id_idx").on(table.shopId),
    medicineIdIdx: index("stock_adjustments_medicine_id_idx").on(table.medicineId),
    batchIdIdx: index("stock_adjustments_batch_id_idx").on(table.batchId),
    createdAtIdx: index("stock_adjustments_created_at_idx").on(table.createdAt),
  }),
);

export const stockTransactions = pgTable(
  "stock_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    medicineId: uuid("medicine_id")
      .notNull()
      .references(() => medicines.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => medicineBatches.id, { onDelete: "restrict" }),
    transactionType: stockTransactionTypeEnum("transaction_type").notNull(),
    quantityIn: integer("quantity_in").notNull().default(0),
    quantityOut: integer("quantity_out").notNull().default(0),
    balanceAfter: integer("balance_after").notNull(),
    referenceType: stockReferenceTypeEnum("reference_type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("stock_transactions_shop_id_idx").on(table.shopId),
    medicineIdIdx: index("stock_transactions_medicine_id_idx").on(table.medicineId),
    batchIdIdx: index("stock_transactions_batch_id_idx").on(table.batchId),
    typeIdx: index("stock_transactions_type_idx").on(table.transactionType),
    referenceIdx: index("stock_transactions_reference_idx").on(
      table.referenceType,
      table.referenceId,
    ),
    createdAtIdx: index("stock_transactions_created_at_idx").on(table.createdAt),
  }),
);

export const lowStockAlertStates = pgTable(
  "low_stock_alert_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    medicineId: uuid("medicine_id")
      .notNull()
      .references(() => medicines.id, { onDelete: "cascade" }),
    isLowStock: boolean("is_low_stock").notNull().default(false),
    currentAvailableQuantity: integer("current_available_quantity")
      .notNull()
      .default(0),
    reorderLevel: integer("reorder_level").notNull().default(0),
    enteredLowStockAt: timestamp("entered_low_stock_at", {
      withTimezone: true,
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    lastAlertSentAt: timestamp("last_alert_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopMedicineUniqueIdx: uniqueIndex(
      "low_stock_alert_states_shop_medicine_unique_idx",
    ).on(table.shopId, table.medicineId),
    shopIdIdx: index("low_stock_alert_states_shop_id_idx").on(table.shopId),
    medicineIdIdx: index("low_stock_alert_states_medicine_id_idx").on(
      table.medicineId,
    ),
    lowStockIdx: index("low_stock_alert_states_is_low_stock_idx").on(
      table.isLowStock,
    ),
  }),
);
export type Shop = typeof shops.$inferSelect;
export type User = typeof users.$inferSelect;
export type VerificationOtp = typeof verificationOtps.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type MedicineCategory = typeof medicineCategories.$inferSelect;
export type Manufacturer = typeof manufacturers.$inferSelect;
export type Medicine = typeof medicines.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type MedicineBatch = typeof medicineBatches.$inferSelect;
export type StockTransaction = typeof stockTransactions.$inferSelect;
export type StockAdjustment = typeof stockAdjustments.$inferSelect;
export type LowStockAlertState = typeof lowStockAlertStates.$inferSelect;
