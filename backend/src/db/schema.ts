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
export type Shop = typeof shops.$inferSelect;
export type User = typeof users.$inferSelect;
export type VerificationOtp = typeof verificationOtps.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type MedicineCategory = typeof medicineCategories.$inferSelect;
export type Manufacturer = typeof manufacturers.$inferSelect;
export type Medicine = typeof medicines.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
