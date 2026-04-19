import {
  boolean,
  jsonb,
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
export const saleStatusEnum = pgEnum("sale_status", [
  "held",
  "completed",
  "cancelled",
]);
export const saleReturnStatusEnum = pgEnum("sale_return_status", [
  "draft",
  "completed",
  "cancelled",
]);
export const purchaseReturnStatusEnum = pgEnum("purchase_return_status", [
  "draft",
  "completed",
  "cancelled",
]);
export const purchaseReturnReasonEnum = pgEnum("purchase_return_reason", [
  "damaged_stock",
  "wrong_item",
  "near_expiry",
  "expired",
  "excess_stock",
  "purchase_mistake",
  "other",
]);
export const salePaymentMethodEnum = pgEnum("sale_payment_method", [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "split",
]);
export const saleReturnRefundMethodEnum = pgEnum("sale_return_refund_method", [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "adjustment",
]);
export const saleReturnRefundStatusEnum = pgEnum("sale_return_refund_status", [
  "pending",
  "processed",
  "not_required",
]);
export const customerGenderEnum = pgEnum("customer_gender", [
  "male",
  "female",
  "other",
]);
export const customerPaymentMethodEnum = pgEnum("customer_payment_method", [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "cheque",
]);
export const paymentRecordStatusEnum = pgEnum("payment_record_status", [
  "completed",
  "cancelled",
]);
export const batchStatusEnum = pgEnum("batch_status", [
  "active",
  "exhausted",
  "expired",
]);
export const ledgerEntityTypeEnum = pgEnum("ledger_entity_type", [
  "customer",
  "supplier",
]);
export const ledgerTransactionTypeEnum = pgEnum("ledger_transaction_type", [
  "opening_balance",
  "sale",
  "sale_return",
  "payment_received",
  "purchase",
  "purchase_return",
  "payment_made",
]);
export const ledgerReferenceTypeEnum = pgEnum("ledger_reference_type", [
  "opening_balance",
  "sale",
  "sale_return",
  "customer_payment",
  "supplier_payment",
  "purchase",
  "purchase_return",
]);
export const stockTransactionTypeEnum = pgEnum("stock_transaction_type", [
  "purchase_in",
  "purchase_return_out",
  "sale_out",
  "sales_return_in",
  "adjustment_in",
  "adjustment_out",
]);
export const stockReferenceTypeEnum = pgEnum("stock_reference_type", [
  "purchase_item",
  "purchase_return_item",
  "sale_item",
  "sale_return_item",
  "stock_adjustment",
]);
export const stockAdjustmentTypeEnum = pgEnum("stock_adjustment_type", [
  "in",
  "out",
]);
export const permissionOverrideEffectEnum = pgEnum(
  "permission_override_effect",
  ["allow", "deny"],
);
export const adminAuditTargetTypeEnum = pgEnum("admin_audit_target_type", [
  "role_permission",
  "user_permission_override",
  "shop_setting",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "low_stock",
  "near_expiry",
  "expired_stock",
  "customer_due",
  "supplier_payable",
  "system_alert",
]);
export const notificationSeverityEnum = pgEnum("notification_severity", [
  "info",
  "warning",
  "critical",
]);
export const notificationEntityTypeEnum = pgEnum("notification_entity_type", [
  "medicine",
  "medicine_batch",
  "customer",
  "supplier",
  "system",
]);
export const notificationEmailStatusEnum = pgEnum("notification_email_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);
export const auditLogSeverityEnum = pgEnum("audit_log_severity", [
  "normal",
  "important",
  "critical",
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

export const shopRolePermissionConfigs = pgTable(
  "shop_role_permission_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
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
    shopRoleUniqueIdx: uniqueIndex(
      "shop_role_permission_configs_shop_role_unique_idx",
    ).on(table.shopId, table.role),
    shopIdIdx: index("shop_role_permission_configs_shop_id_idx").on(table.shopId),
  }),
);

export const shopRolePermissions = pgTable(
  "shop_role_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    permission: varchar("permission", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopRolePermissionUniqueIdx: uniqueIndex(
      "shop_role_permissions_shop_role_permission_unique_idx",
    ).on(table.shopId, table.role, table.permission),
    shopIdIdx: index("shop_role_permissions_shop_id_idx").on(table.shopId),
    roleIdx: index("shop_role_permissions_role_idx").on(table.role),
    permissionIdx: index("shop_role_permissions_permission_idx").on(
      table.permission,
    ),
  }),
);

export const userPermissionOverrides = pgTable(
  "user_permission_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: varchar("permission", { length: 80 }).notNull(),
    effect: permissionOverrideEffectEnum("effect").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userPermissionUniqueIdx: uniqueIndex(
      "user_permission_overrides_user_permission_unique_idx",
    ).on(table.userId, table.permission),
    shopIdIdx: index("user_permission_overrides_shop_id_idx").on(table.shopId),
    userIdIdx: index("user_permission_overrides_user_id_idx").on(table.userId),
    effectIdx: index("user_permission_overrides_effect_idx").on(table.effect),
  }),
);

export const shopSettings = pgTable("shop_settings", {
  shopId: uuid("shop_id")
    .primaryKey()
    .references(() => shops.id, { onDelete: "cascade" }),
  defaultLowStockThreshold: integer("default_low_stock_threshold")
    .notNull()
    .default(10),
  lowStockAlertsEnabled: boolean("low_stock_alerts_enabled")
    .notNull()
    .default(true),
  lowStockEmailAlertsEnabled: boolean("low_stock_email_alerts_enabled")
    .notNull()
    .default(true),
  nearExpiryAlertDays: integer("near_expiry_alert_days").notNull().default(30),
  expiryAlertsEnabled: boolean("expiry_alerts_enabled").notNull().default(true),
  expiryEmailAlertsEnabled: boolean("expiry_email_alerts_enabled")
    .notNull()
    .default(true),
  invoicePrefix: varchar("invoice_prefix", { length: 20 })
    .notNull()
    .default("INV"),
  allowPartialPayments: boolean("allow_partial_payments")
    .notNull()
    .default(true),
  allowHeldBills: boolean("allow_held_bills").notNull().default(true),
  allowStaffSalesReturn: boolean("allow_staff_sales_return")
    .notNull()
    .default(true),
  allowInventoryAdjustment: boolean("allow_inventory_adjustment")
    .notNull()
    .default(true),
  allowDraftPurchases: boolean("allow_draft_purchases")
    .notNull()
    .default(true),
  preferFefo: boolean("prefer_fefo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    targetType: adminAuditTargetTypeEnum("target_type").notNull(),
    targetId: varchar("target_id", { length: 120 }),
    action: varchar("action", { length: 80 }).notNull(),
    oldValue: jsonb("old_value").$type<Record<string, unknown> | null>(),
    newValue: jsonb("new_value").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("admin_audit_logs_shop_id_idx").on(table.shopId),
    actorUserIdIdx: index("admin_audit_logs_actor_user_id_idx").on(
      table.actorUserId,
    ),
    targetTypeIdx: index("admin_audit_logs_target_type_idx").on(table.targetType),
    createdAtIdx: index("admin_audit_logs_created_at_idx").on(table.createdAt),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    message: text("message").notNull(),
    severity: notificationSeverityEnum("severity").notNull(),
    entityType: notificationEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id"),
    conditionKey: varchar("condition_key", { length: 220 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    deliveryChannels: jsonb("delivery_channels").$type<string[]>().notNull(),
    emailStatus: notificationEmailStatusEnum("email_status")
      .notNull()
      .default("skipped"),
    readAt: timestamp("read_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedByUserId: uuid("acknowledged_by_user_id").references(
      () => users.id,
      {
        onDelete: "set null",
      },
    ),
    isActive: boolean("is_active").notNull().default(true),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("notifications_shop_id_idx").on(table.shopId),
    typeIdx: index("notifications_type_idx").on(table.type),
    severityIdx: index("notifications_severity_idx").on(table.severity),
    entityIdx: index("notifications_entity_idx").on(table.entityType, table.entityId),
    conditionKeyIdx: index("notifications_condition_key_idx").on(table.conditionKey),
    activeIdx: index("notifications_is_active_idx").on(table.isActive),
    unreadIdx: index("notifications_read_at_idx").on(table.readAt),
    acknowledgedIdx: index("notifications_acknowledged_at_idx").on(
      table.acknowledgedAt,
    ),
    emailStatusIdx: index("notifications_email_status_idx").on(table.emailStatus),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    actorRole: userRoleEnum("actor_role").notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    module: varchar("module", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: varchar("entity_id", { length: 120 }).notNull(),
    severity: auditLogSeverityEnum("severity").notNull().default("normal"),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description").notNull(),
    beforeData: jsonb("before_data").$type<Record<string, unknown> | null>(),
    afterData: jsonb("after_data").$type<Record<string, unknown> | null>(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("audit_logs_shop_id_idx").on(table.shopId),
    actorUserIdIdx: index("audit_logs_actor_user_id_idx").on(table.actorUserId),
    moduleIdx: index("audit_logs_module_idx").on(table.module),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    severityIdx: index("audit_logs_severity_idx").on(table.severity),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
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
export const customerCounters = pgTable("customer_counters", {
  shopId: uuid("shop_id")
    .primaryKey()
    .references(() => shops.id, { onDelete: "cascade" }),
  lastSequence: integer("last_sequence").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    customerSequence: integer("customer_sequence").notNull(),
    customerCode: varchar("customer_code", { length: 40 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    fullNameNormalized: varchar("full_name_normalized", { length: 160 }).notNull(),
    mobileNumber: varchar("mobile_number", { length: 20 }).notNull(),
    alternateMobileNumber: varchar("alternate_mobile_number", { length: 20 }),
    email: varchar("email", { length: 320 }),
    emailNormalized: varchar("email_normalized", { length: 320 }),
    gender: customerGenderEnum("gender"),
    age: integer("age"),
    dateOfBirth: timestamp("date_of_birth", { withTimezone: true }),
    addressLine1: varchar("address_line1", { length: 255 }),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    pincode: varchar("pincode", { length: 20 }),
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
    shopIdIdx: index("customers_shop_id_idx").on(table.shopId),
    codeIdx: uniqueIndex("customers_shop_customer_code_unique_idx").on(
      table.shopId,
      table.customerCode,
    ),
    sequenceIdx: uniqueIndex("customers_shop_customer_sequence_unique_idx").on(
      table.shopId,
      table.customerSequence,
    ),
    mobileUniqueIdx: uniqueIndex("customers_shop_mobile_unique_idx").on(
      table.shopId,
      table.mobileNumber,
    ),
    emailUniqueIdx: uniqueIndex("customers_shop_email_unique_idx").on(
      table.shopId,
      table.emailNormalized,
    ),
    statusIdx: index("customers_status_idx").on(table.status),
    nameSearchIdx: index("customers_full_name_normalized_idx").on(
      table.fullNameNormalized,
    ),
    mobileIdx: index("customers_mobile_number_idx").on(table.mobileNumber),
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
    initialPaidAmount: numeric("initial_paid_amount", { precision: 14, scale: 2 })
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

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    billSequence: integer("bill_sequence").notNull(),
    billNumber: varchar("bill_number", { length: 40 }).notNull(),
    billNumberNormalized: varchar("bill_number_normalized", {
      length: 40,
    }).notNull(),
    customerId: uuid("customer_id"),
    customerName: varchar("customer_name", { length: 160 }),
    customerPhone: varchar("customer_phone", { length: 20 }),
    status: saleStatusEnum("status").notNull().default("held"),
    paymentStatus: purchasePaymentStatusEnum("payment_status")
      .notNull()
      .default("unpaid"),
    paymentMethod: salePaymentMethodEnum("payment_method")
      .notNull()
      .default("cash"),
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
    initialPaidAmount: numeric("initial_paid_amount", { precision: 14, scale: 2 })
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
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("sales_shop_id_idx").on(table.shopId),
    customerIdIdx: index("sales_customer_id_idx").on(table.customerId),
    statusIdx: index("sales_status_idx").on(table.status),
    paymentStatusIdx: index("sales_payment_status_idx").on(table.paymentStatus),
    completedAtIdx: index("sales_completed_at_idx").on(table.completedAt),
    createdByIdx: index("sales_created_by_user_id_idx").on(table.createdByUserId),
    billSequenceIdx: uniqueIndex("sales_shop_bill_sequence_unique_idx").on(
      table.shopId,
      table.billSequence,
    ),
    billNumberIdx: uniqueIndex("sales_shop_bill_number_unique_idx").on(
      table.shopId,
      table.billNumberNormalized,
    ),
  }),
);

export const customerPayments = pgTable(
  "customer_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    saleId: uuid("sale_id").references(() => sales.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    paymentMethod: customerPaymentMethodEnum("payment_method").notNull(),
    status: paymentRecordStatusEnum("status").notNull().default("completed"),
    referenceNumber: varchar("reference_number", { length: 120 }),
    notes: text("notes"),
    receivedByUserId: uuid("received_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("customer_payments_shop_id_idx").on(table.shopId),
    customerIdIdx: index("customer_payments_customer_id_idx").on(table.customerId),
    saleIdIdx: index("customer_payments_sale_id_idx").on(table.saleId),
    statusIdx: index("customer_payments_status_idx").on(table.status),
    paymentDateIdx: index("customer_payments_payment_date_idx").on(
      table.paymentDate,
    ),
    receivedByIdx: index("customer_payments_received_by_user_id_idx").on(
      table.receivedByUserId,
    ),
  }),
);

export const customerPaymentAllocations = pgTable(
  "customer_payment_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    customerPaymentId: uuid("customer_payment_id")
      .notNull()
      .references(() => customerPayments.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("customer_payment_allocations_shop_id_idx").on(table.shopId),
    paymentIdIdx: index("customer_payment_allocations_payment_id_idx").on(
      table.customerPaymentId,
    ),
    customerIdIdx: index("customer_payment_allocations_customer_id_idx").on(
      table.customerId,
    ),
    saleIdIdx: index("customer_payment_allocations_sale_id_idx").on(table.saleId),
    uniqueAllocationIdx: uniqueIndex(
      "customer_payment_allocations_payment_sale_unique_idx",
    ).on(table.customerPaymentId, table.saleId),
  }),
);

export const supplierPayments = pgTable(
  "supplier_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    purchaseId: uuid("purchase_id").references(() => purchases.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    paymentMethod: customerPaymentMethodEnum("payment_method").notNull(),
    status: paymentRecordStatusEnum("status").notNull().default("completed"),
    referenceNumber: varchar("reference_number", { length: 120 }),
    notes: text("notes"),
    paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),
    paidByUserId: uuid("paid_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("supplier_payments_shop_id_idx").on(table.shopId),
    supplierIdIdx: index("supplier_payments_supplier_id_idx").on(table.supplierId),
    purchaseIdIdx: index("supplier_payments_purchase_id_idx").on(table.purchaseId),
    statusIdx: index("supplier_payments_status_idx").on(table.status),
    paymentDateIdx: index("supplier_payments_payment_date_idx").on(table.paymentDate),
    paidByIdx: index("supplier_payments_paid_by_user_id_idx").on(table.paidByUserId),
  }),
);

export const supplierPaymentAllocations = pgTable(
  "supplier_payment_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    supplierPaymentId: uuid("supplier_payment_id")
      .notNull()
      .references(() => supplierPayments.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("supplier_payment_allocations_shop_id_idx").on(table.shopId),
    paymentIdIdx: index("supplier_payment_allocations_payment_id_idx").on(
      table.supplierPaymentId,
    ),
    supplierIdIdx: index("supplier_payment_allocations_supplier_id_idx").on(
      table.supplierId,
    ),
    purchaseIdIdx: index("supplier_payment_allocations_purchase_id_idx").on(
      table.purchaseId,
    ),
    uniqueAllocationIdx: uniqueIndex(
      "supplier_payment_allocations_payment_purchase_unique_idx",
    ).on(table.supplierPaymentId, table.purchaseId),
  }),
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    entityType: ledgerEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    transactionType: ledgerTransactionTypeEnum("transaction_type").notNull(),
    debit: numeric("debit", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    credit: numeric("credit", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    balanceAfter: numeric("balance_after", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    entryDate: timestamp("entry_date", { withTimezone: true }).notNull(),
    referenceType: ledgerReferenceTypeEnum("reference_type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("ledger_entries_shop_id_idx").on(table.shopId),
    entityIdx: index("ledger_entries_entity_idx").on(
      table.shopId,
      table.entityType,
      table.entityId,
    ),
    transactionTypeIdx: index("ledger_entries_transaction_type_idx").on(
      table.transactionType,
    ),
    entryDateIdx: index("ledger_entries_entry_date_idx").on(table.entryDate),
    referenceIdx: index("ledger_entries_reference_idx").on(
      table.referenceType,
      table.referenceId,
    ),
  }),
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    medicineId: uuid("medicine_id")
      .notNull()
      .references(() => medicines.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => medicineBatches.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    rate: numeric("rate", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    mrp: numeric("mrp", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    gstPercent: integer("gst_percent").notNull().default(0),
    discountPercent: numeric("discount_percent", { precision: 7, scale: 2 })
      .notNull()
      .default("0.00"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 })
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
    shopIdIdx: index("sale_items_shop_id_idx").on(table.shopId),
    saleIdIdx: index("sale_items_sale_id_idx").on(table.saleId),
    medicineIdIdx: index("sale_items_medicine_id_idx").on(table.medicineId),
    batchIdIdx: index("sale_items_batch_id_idx").on(table.batchId),
  }),
);

export const saleReturns = pgTable(
  "sale_returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "restrict" }),
    returnSequence: integer("return_sequence").notNull(),
    returnNumber: varchar("return_number", { length: 40 }).notNull(),
    returnNumberNormalized: varchar("return_number_normalized", {
      length: 40,
    }).notNull(),
    status: saleReturnStatusEnum("status").notNull().default("draft"),
    totalReturnAmount: numeric("total_return_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    refundAmount: numeric("refund_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    refundMethod: saleReturnRefundMethodEnum("refund_method"),
    refundStatus: saleReturnRefundStatusEnum("refund_status")
      .notNull()
      .default("not_required"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    completedByUserId: uuid("completed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("sale_returns_shop_id_idx").on(table.shopId),
    saleIdIdx: index("sale_returns_sale_id_idx").on(table.saleId),
    statusIdx: index("sale_returns_status_idx").on(table.status),
    refundStatusIdx: index("sale_returns_refund_status_idx").on(table.refundStatus),
    createdAtIdx: index("sale_returns_created_at_idx").on(table.createdAt),
    completedAtIdx: index("sale_returns_completed_at_idx").on(table.completedAt),
    createdByIdx: index("sale_returns_created_by_user_id_idx").on(
      table.createdByUserId,
    ),
    completedByIdx: index("sale_returns_completed_by_user_id_idx").on(
      table.completedByUserId,
    ),
    sequenceIdx: uniqueIndex("sale_returns_shop_return_sequence_unique_idx").on(
      table.shopId,
      table.returnSequence,
    ),
    numberIdx: uniqueIndex("sale_returns_shop_return_number_unique_idx").on(
      table.shopId,
      table.returnNumberNormalized,
    ),
  }),
);

export const saleReturnItems = pgTable(
  "sale_return_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    returnId: uuid("return_id")
      .notNull()
      .references(() => saleReturns.id, { onDelete: "cascade" }),
    saleItemId: uuid("sale_item_id")
      .notNull()
      .references(() => saleItems.id, { onDelete: "restrict" }),
    medicineId: uuid("medicine_id")
      .notNull()
      .references(() => medicines.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => medicineBatches.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    rate: numeric("rate", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    taxPercent: integer("tax_percent").notNull().default(0),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    lineReturnAmount: numeric("line_return_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    reason: varchar("reason", { length: 160 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("sale_return_items_shop_id_idx").on(table.shopId),
    returnIdIdx: index("sale_return_items_return_id_idx").on(table.returnId),
    saleItemIdIdx: index("sale_return_items_sale_item_id_idx").on(table.saleItemId),
    medicineIdIdx: index("sale_return_items_medicine_id_idx").on(table.medicineId),
    batchIdIdx: index("sale_return_items_batch_id_idx").on(table.batchId),
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

export const purchaseReturns = pgTable(
  "purchase_returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    returnSequence: integer("return_sequence").notNull(),
    returnNumber: varchar("return_number", { length: 40 }).notNull(),
    returnNumberNormalized: varchar("return_number_normalized", {
      length: 40,
    }).notNull(),
    status: purchaseReturnStatusEnum("status").notNull().default("draft"),
    totalReturnAmount: numeric("total_return_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    completedByUserId: uuid("completed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("purchase_returns_shop_id_idx").on(table.shopId),
    purchaseIdIdx: index("purchase_returns_purchase_id_idx").on(table.purchaseId),
    supplierIdIdx: index("purchase_returns_supplier_id_idx").on(table.supplierId),
    statusIdx: index("purchase_returns_status_idx").on(table.status),
    createdAtIdx: index("purchase_returns_created_at_idx").on(table.createdAt),
    completedAtIdx: index("purchase_returns_completed_at_idx").on(table.completedAt),
    createdByIdx: index("purchase_returns_created_by_user_id_idx").on(
      table.createdByUserId,
    ),
    completedByIdx: index("purchase_returns_completed_by_user_id_idx").on(
      table.completedByUserId,
    ),
    sequenceIdx: uniqueIndex(
      "purchase_returns_shop_return_sequence_unique_idx",
    ).on(table.shopId, table.returnSequence),
    numberIdx: uniqueIndex("purchase_returns_shop_return_number_unique_idx").on(
      table.shopId,
      table.returnNumberNormalized,
    ),
  }),
);

export const purchaseReturnItems = pgTable(
  "purchase_return_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    returnId: uuid("return_id")
      .notNull()
      .references(() => purchaseReturns.id, { onDelete: "cascade" }),
    purchaseItemId: uuid("purchase_item_id")
      .notNull()
      .references(() => purchaseItems.id, { onDelete: "restrict" }),
    medicineId: uuid("medicine_id")
      .notNull()
      .references(() => medicines.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => medicineBatches.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    purchaseRate: numeric("purchase_rate", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    taxPercent: integer("tax_percent").notNull().default(0),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    lineReturnAmount: numeric("line_return_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    reason: purchaseReturnReasonEnum("reason").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shopIdIdx: index("purchase_return_items_shop_id_idx").on(table.shopId),
    returnIdIdx: index("purchase_return_items_return_id_idx").on(table.returnId),
    purchaseItemIdIdx: index("purchase_return_items_purchase_item_id_idx").on(
      table.purchaseItemId,
    ),
    medicineIdIdx: index("purchase_return_items_medicine_id_idx").on(
      table.medicineId,
    ),
    batchIdIdx: index("purchase_return_items_batch_id_idx").on(table.batchId),
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
export type ShopRolePermissionConfig =
  typeof shopRolePermissionConfigs.$inferSelect;
export type ShopRolePermission = typeof shopRolePermissions.$inferSelect;
export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;
export type ShopSettings = typeof shopSettings.$inferSelect;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type VerificationOtp = typeof verificationOtps.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type MedicineCategory = typeof medicineCategories.$inferSelect;
export type Manufacturer = typeof manufacturers.$inferSelect;
export type Medicine = typeof medicines.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type CustomerCounter = typeof customerCounters.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type PurchaseReturn = typeof purchaseReturns.$inferSelect;
export type PurchaseReturnItem = typeof purchaseReturnItems.$inferSelect;
export type MedicineBatch = typeof medicineBatches.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type SaleReturn = typeof saleReturns.$inferSelect;
export type SaleReturnItem = typeof saleReturnItems.$inferSelect;
export type CustomerPayment = typeof customerPayments.$inferSelect;
export type CustomerPaymentAllocation =
  typeof customerPaymentAllocations.$inferSelect;
export type SupplierPayment = typeof supplierPayments.$inferSelect;
export type SupplierPaymentAllocation =
  typeof supplierPaymentAllocations.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type StockTransaction = typeof stockTransactions.$inferSelect;
export type StockAdjustment = typeof stockAdjustments.$inferSelect;
export type LowStockAlertState = typeof lowStockAlertStates.$inferSelect;
