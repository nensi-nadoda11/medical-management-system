import { randomUUID } from "crypto";

import {
  and,
  count as countRows,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  sql,
} from "drizzle-orm";

import { db, pool } from "../src/db/client";
import {
  branches,
  customerPayments,
  customers,
  medicineBatches,
  medicineCategories,
  medicines,
  notifications,
  purchases,
  saleReturns,
  sales,
  shopSettings,
  shops,
  supplierPayments,
  suppliers,
  userBranches,
  users,
  type Notification,
} from "../src/db/schema";
import { AccountingRepository } from "../src/modules/accounting/accounting.repository";
import { AccountingService } from "../src/modules/accounting/accounting.service";
import { AdminSettingsService } from "../src/modules/admin-settings/admin-settings.service";
import { AlertsService } from "../src/modules/alerts/alerts.service";
import type { PublicUser } from "../src/modules/auth/auth.types";
import { BranchesService } from "../src/modules/branches/branches.service";
import { BillingService } from "../src/modules/billing/billing.service";
import { CustomersService } from "../src/modules/customers/customers.service";
import { InventoryService } from "../src/modules/inventory/inventory.service";
import { MedicinesService } from "../src/modules/medicines/medicines.service";
import { NotificationsRepository } from "../src/modules/notifications/notifications.repository";
import { PurchaseReturnsService } from "../src/modules/purchase-returns/purchase-returns.service";
import { PurchasesService } from "../src/modules/purchases/purchases.service";
import { SalesReturnsService } from "../src/modules/sales-returns/sales-returns.service";
import { StockTransfersService } from "../src/modules/stock-transfers/stock-transfers.service";
import { SuppliersService } from "../src/modules/suppliers/suppliers.service";
import { hashPassword } from "../src/shared/security/password";
import { normalizePhoneNumber } from "../src/shared/utils/phone";

type SeedArgs = {
  adminEmail?: string;
  shopId?: string;
  count: number;
  tag: string;
};

type SeedBranch = {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
};

type SeedUser = {
  id: string;
  fullName: string;
  email: string;
  role: "admin" | "staff" | "accountant";
};

type SeedSupplier = {
  id: string;
  supplierName: string;
};

type SeedCustomer = {
  id: string;
  fullName: string;
};

type SeedMedicine = {
  id: string;
  medicineName: string;
  genericName: string;
  gstPercent: number;
  reorderLevel: number;
  form:
    | "tablet"
    | "capsule"
    | "syrup"
    | "injection"
    | "ointment"
    | "cream"
    | "drops"
    | "inhaler"
    | "powder"
    | "gel"
    | "lotion"
    | "solution"
    | "suspension"
    | "spray"
    | "vial"
    | "sachet"
    | "other";
  unit:
    | "strip"
    | "bottle"
    | "piece"
    | "box"
    | "vial"
    | "tube"
    | "sachet"
    | "ampoule"
    | "packet"
    | "kit"
    | "container"
    | "canister"
    | "other";
  basePurchaseRate: number;
  baseSaleRate: number;
  baseMrp: number;
};

type SeedMedicineTemplate = {
  name: string;
  generic: string;
  form: SeedMedicine["form"];
  unit: SeedMedicine["unit"];
};

const DEFAULT_COUNT = 50;
const DEFAULT_USER_PASSWORD = "SeedAccess@123";
const TEAM_USER_TARGET = 12;
const BRANCH_TARGET = 4;
const CATEGORY_TARGET = 12;
const MANUFACTURER_TARGET = 12;

const CUSTOMER_PAYMENT_METHODS = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "cheque",
] as const;
const SALE_PAYMENT_METHODS = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "split",
] as const;
const STOCK_ADJUSTMENT_TYPES = ["in", "out"] as const;
const PURCHASE_RETURN_REASONS = [
  "damaged_stock",
  "wrong_item",
  "near_expiry",
  "expired",
  "excess_stock",
  "purchase_mistake",
  "other",
] as const;
const SALES_RETURN_REASONS = [
  "Damaged pack",
  "Billing correction",
  "Customer changed mind",
  "Wrong item",
  "Near expiry concern",
] as const;

const categoryCatalog = [
  "Pain Relief",
  "Antibiotics",
  "Diabetes Care",
  "Cardiac Support",
  "Respiratory Care",
  "Digestive Health",
  "Dermatology",
  "Pediatrics",
  "Neurology",
  "Orthopedic Care",
  "Vitamins",
  "Critical Care",
] as const;

const manufacturerCatalog = [
  "Sunrise Pharma",
  "Medisphere Labs",
  "Apex Remedies",
  "Wellcare Biotech",
  "BlueLeaf Healthcare",
  "PrimeCure Formulations",
  "NovaMed Lifesciences",
  "UrbanMeds",
  "Sterling Therapeutics",
  "CureVista Drugs",
  "Lotus Remedies",
  "VitalAxis Pharma",
] as const;

const medicineCatalog: readonly SeedMedicineTemplate[] = [
  { name: "Paracetamol", generic: "Paracetamol", form: "tablet", unit: "strip" },
  { name: "Azithromycin", generic: "Azithromycin", form: "tablet", unit: "strip" },
  { name: "Amoxicillin", generic: "Amoxicillin", form: "capsule", unit: "strip" },
  { name: "Pantoprazole", generic: "Pantoprazole", form: "tablet", unit: "strip" },
  { name: "Cefixime", generic: "Cefixime", form: "tablet", unit: "strip" },
  { name: "Dolo", generic: "Paracetamol", form: "tablet", unit: "strip" },
  { name: "Montelukast", generic: "Montelukast", form: "tablet", unit: "strip" },
  { name: "Cetirizine", generic: "Cetirizine", form: "tablet", unit: "strip" },
  { name: "Ibuprofen", generic: "Ibuprofen", form: "tablet", unit: "strip" },
  { name: "Metformin", generic: "Metformin", form: "tablet", unit: "strip" },
  { name: "Telmisartan", generic: "Telmisartan", form: "tablet", unit: "strip" },
  { name: "Atorvastatin", generic: "Atorvastatin", form: "tablet", unit: "strip" },
  { name: "Levocetirizine", generic: "Levocetirizine", form: "tablet", unit: "strip" },
  { name: "ORS", generic: "Electrolytes", form: "powder", unit: "sachet" },
  { name: "Insulin", generic: "Human Insulin", form: "vial", unit: "vial" },
  { name: "Cough Syrup", generic: "Ambroxol", form: "syrup", unit: "bottle" },
  { name: "Diclofenac Gel", generic: "Diclofenac", form: "gel", unit: "tube" },
  { name: "Vitamin D3", generic: "Cholecalciferol", form: "capsule", unit: "strip" },
  { name: "Calcium Plus", generic: "Calcium Carbonate", form: "tablet", unit: "strip" },
  { name: "Saline", generic: "Sodium Chloride", form: "solution", unit: "bottle" },
  { name: "Nebulizer Respule", generic: "Levosalbutamol", form: "solution", unit: "packet" },
  { name: "Mupirocin", generic: "Mupirocin", form: "ointment", unit: "tube" },
  { name: "Eye Drops", generic: "Carboxymethylcellulose", form: "drops", unit: "bottle" },
  { name: "Loratadine", generic: "Loratadine", form: "tablet", unit: "strip" },
  { name: "Rabeprazole", generic: "Rabeprazole", form: "tablet", unit: "strip" },
] as const;

const strengths = [
  "5 mg",
  "10 mg",
  "20 mg",
  "40 mg",
  "50 mg",
  "100 mg",
  "200 mg",
  "250 mg",
  "500 mg",
  "650 mg",
  "1 g",
  "5 ml",
  "10 ml",
] as const;

const firstNames = [
  "Aarav",
  "Vivaan",
  "Aditya",
  "Ishita",
  "Diya",
  "Kavya",
  "Meera",
  "Riya",
  "Ananya",
  "Saanvi",
  "Rahul",
  "Priya",
  "Neha",
  "Arjun",
  "Rohan",
  "Kunal",
  "Sneha",
  "Nikita",
  "Pooja",
  "Manav",
  "Dev",
  "Aisha",
  "Farhan",
  "Om",
  "Mitali",
] as const;

const lastNames = [
  "Sharma",
  "Verma",
  "Patel",
  "Gupta",
  "Nair",
  "Iyer",
  "Yadav",
  "Singh",
  "Khan",
  "Kulkarni",
  "Joshi",
  "Reddy",
  "Saxena",
  "Desai",
  "Mishra",
  "Agarwal",
] as const;

const cities = [
  "Ahmedabad",
  "Mumbai",
  "Pune",
  "Surat",
  "Indore",
  "Jaipur",
  "Nagpur",
  "Lucknow",
  "Bhopal",
  "Nashik",
] as const;

const states = [
  "Gujarat",
  "Maharashtra",
  "Rajasthan",
  "Madhya Pradesh",
  "Uttar Pradesh",
] as const;

const branchesCatalog = [
  { name: "Main Counter", code: "MAIN", invoicePrefix: "INV" },
  { name: "City Branch", code: "CITY", invoicePrefix: "CITY" },
  { name: "Warehouse", code: "WH", invoicePrefix: "WH" },
  { name: "Night Desk", code: "NIGHT", invoicePrefix: "NGT" },
] as const;

const roundMoney = (value: number) => Number(value.toFixed(2));

const buildSeedNumber = (value: string) =>
  value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);

const createRng = (seed: string) => {
  let state = buildSeedNumber(seed) || 1;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const parseArgs = (): SeedArgs => {
  const args = process.argv.slice(2);
  const parsed: SeedArgs = {
    count: DEFAULT_COUNT,
    tag: `seed-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (current === "--admin-email" && next) {
      parsed.adminEmail = next.trim().toLowerCase();
      index += 1;
      continue;
    }

    if (current === "--shop-id" && next) {
      parsed.shopId = next.trim();
      index += 1;
      continue;
    }

    if (current === "--count" && next) {
      const count = Number.parseInt(next, 10);
      if (Number.isFinite(count) && count > 0) {
        parsed.count = count;
      }
      index += 1;
      continue;
    }

    if (current === "--tag" && next) {
      parsed.tag = next.trim().toLowerCase();
      index += 1;
    }
  }

  return parsed;
};

const sample = <T>(items: readonly T[], rng: () => number) => {
  const item = items[Math.floor(rng() * items.length)];

  if (item === undefined) {
    throw new Error("Cannot sample from an empty collection.");
  }

  return item;
};

const sampleManyDistinct = <T>(
  items: readonly T[],
  count: number,
  rng: () => number,
) => {
  const pool = [...items];
  const picked: T[] = [];

  while (pool.length && picked.length < count) {
    const index = Math.floor(rng() * pool.length);
    const [item] = pool.splice(index, 1);
    if (item !== undefined) {
      picked.push(item);
    }
  }

  return picked;
};

const randomInt = (min: number, max: number, rng: () => number) =>
  Math.floor(rng() * (max - min + 1)) + min;

const randomDateBetween = (start: Date, end: Date, rng: () => number) => {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const value = startMs + Math.floor(rng() * Math.max(endMs - startMs, 1));
  return new Date(value);
};

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const titleCase = (value: string) =>
  value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const toPhone = (seedNumber: number) => {
  const normalized = normalizePhoneNumber(
    `+91${(9000000000 + seedNumber).toString().slice(-10)}`,
  );

  if (!normalized) {
    throw new Error(`Failed to normalize phone number for seed value ${seedNumber}.`);
  }

  return normalized;
};

const toPincode = (seedNumber: number) =>
  (380000 + (seedNumber % 999)).toString().padStart(6, "0");

const toGst = (seedNumber: number) => {
  const stateCode = (seedNumber % 36).toString().padStart(2, "0");
  const panBody = `${String.fromCharCode(65 + (seedNumber % 26))}BCDE${String(
    1000 + (seedNumber % 8999),
  )}F`;
  const suffix = `${(seedNumber % 9) + 1}Z${seedNumber % 10}`;
  return `${stateCode}${panBody}${suffix}`.slice(0, 15);
};

const formatAmount = (value: number) => roundMoney(value);

const toPublicActor = async (user: {
  id: string;
  shopId: string;
  role: "admin" | "staff" | "accountant";
  fullName: string;
  email: string;
  mobileNumber: string | null;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  mobileVerifiedAt: Date | null;
}) => {
  const adminSettingsService = new AdminSettingsService();
  const permissions = await adminSettingsService.resolveEffectivePermissionsForUser({
    shopId: user.shopId,
    userId: user.id,
    role: user.role,
  });

  return {
    id: user.id,
    shopId: user.shopId,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    mobileNumber: user.mobileNumber ?? "",
    isActive: user.isActive,
    emailVerified: Boolean(user.emailVerifiedAt),
    mobileVerified: Boolean(user.mobileVerifiedAt),
    permissions,
  } satisfies PublicUser;
};

const pickRoleActor = (
  adminActor: PublicUser,
  seededUsers: SeedUser[],
  role: "admin" | "staff" | "accountant",
  rng: () => number,
) => {
  if (role === "admin") {
    return adminActor;
  }

  const matching = seededUsers.filter((user) => user.role === role);
  const chosen = matching.length ? sample(matching, rng) : undefined;

  return chosen
    ? {
        ...adminActor,
        id: chosen.id,
        fullName: chosen.fullName,
        email: chosen.email,
        role,
      }
    : adminActor;
};

const ensureTestingShopSettings = async (shopId: string) => {
  await db
    .insert(shopSettings)
    .values({
      shopId,
      allowDraftPurchases: true,
      allowHeldBills: true,
      allowInventoryAdjustment: true,
      allowPartialPayments: true,
      allowStaffSalesReturn: true,
      preferFefo: true,
      lowStockAlertsEnabled: true,
      expiryAlertsEnabled: true,
      lowStockEmailAlertsEnabled: false,
      expiryEmailAlertsEnabled: false,
      defaultLowStockThreshold: 12,
      nearExpiryAlertDays: 30,
      invoicePrefix: "INV",
    })
    .onConflictDoUpdate({
      target: shopSettings.shopId,
      set: {
        allowDraftPurchases: true,
        allowHeldBills: true,
        allowInventoryAdjustment: true,
        allowPartialPayments: true,
        allowStaffSalesReturn: true,
        preferFefo: true,
        lowStockAlertsEnabled: true,
        expiryAlertsEnabled: true,
        lowStockEmailAlertsEnabled: false,
        expiryEmailAlertsEnabled: false,
        updatedAt: new Date(),
      },
    });
};

const findTargetAdmin = async (args: SeedArgs) => {
  const filters = [
    eq(users.role, "admin"),
    eq(users.isActive, true),
    eq(shops.status, "active"),
  ];

  if (args.adminEmail) {
    filters.push(eq(users.email, args.adminEmail));
  }

  if (args.shopId) {
    filters.push(eq(users.shopId, args.shopId));
  }

  const [record] = await db
    .select({
      user: users,
      shop: shops,
    })
    .from(users)
    .innerJoin(shops, eq(users.shopId, shops.id))
    .where(and(...filters))
    .orderBy(desc(users.createdAt))
    .limit(1);

  if (!record) {
    throw new Error(
      "No active admin/shop pair was found. Register and verify the admin account first, then rerun the seed.",
    );
  }

  return record;
};

const ensureBranches = async (
  shopId: string,
  actor: PublicUser,
  rng: () => number,
) => {
  const branchesService = new BranchesService();
  const existing = await db
    .select({
      id: branches.id,
      name: branches.name,
      code: branches.code,
      isDefault: branches.isDefault,
    })
    .from(branches)
    .where(eq(branches.shopId, shopId))
    .orderBy(desc(branches.isDefault), branches.createdAt);

  let current = [...existing];

  if (!current.length) {
    const created = await branchesService.createBranch(
      shopId,
      {
        name: "Main Counter",
        code: "MAIN",
        address: "Ground floor retail counter",
        contactNumber: "+91 90000 00000",
        status: "active",
        isDefault: true,
        settings: {
          invoicePrefix: "INV",
          lowStockThreshold: 12,
          lowStockAlertsEnabled: true,
          lowStockEmailAlertsEnabled: false,
          nearExpiryAlertDays: 30,
          expiryAlertsEnabled: true,
          expiryEmailAlertsEnabled: false,
        },
      },
      actor,
    );

    current = [
      {
        id: created.id,
        name: created.name,
        code: created.code,
        isDefault: created.isDefault,
      },
    ];
  }

  for (const branchConfig of branchesCatalog) {
    if (current.length >= BRANCH_TARGET) {
      break;
    }

    if (current.some((branch) => branch.code === branchConfig.code)) {
      continue;
    }

    const created = await branchesService.createBranch(
      shopId,
      {
        name: branchConfig.name,
        code: branchConfig.code,
        address: `${branchConfig.name}, ${sample(cities, rng)}, ${sample(states, rng)}`,
        contactNumber: toPhone(randomInt(1000000, 8999999, rng)),
        status: "active",
        isDefault: false,
        settings: {
          invoicePrefix: branchConfig.invoicePrefix,
          lowStockThreshold: 10 + randomInt(0, 4, rng),
          lowStockAlertsEnabled: true,
          lowStockEmailAlertsEnabled: false,
          nearExpiryAlertDays: 30,
          expiryAlertsEnabled: true,
          expiryEmailAlertsEnabled: false,
        },
      },
      actor,
    );

    current.push({
      id: created.id,
      name: created.name,
      code: created.code,
      isDefault: created.isDefault,
    });
  }

  return current;
};

const ensureSeedUsers = async (
  shopId: string,
  branchList: SeedBranch[],
  args: SeedArgs,
  rng: () => number,
) => {
  const createdUsers: SeedUser[] = [];
  const passwordHash = await hashPassword(DEFAULT_USER_PASSWORD);
  const now = new Date();

  for (let index = 0; index < TEAM_USER_TARGET; index += 1) {
    const role = index % 3 === 0 ? "accountant" : "staff";
    const firstName = sample(firstNames, rng);
    const lastName = sample(lastNames, rng);
    const fullName = `${firstName} ${lastName}`;
    const email = `${role}.${args.tag}.${index + 1}@seed-mms.local`;
    const mobileNumber = toPhone(1000000 + index + buildSeedNumber(args.tag));

    const [user] = await db
      .insert(users)
      .values({
        shopId,
        role,
        fullName,
        email,
        mobileNumber,
        passwordHash,
        emailVerifiedAt: now,
        mobileVerifiedAt: now,
        isActive: true,
      })
      .returning({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      });

    if (!user) {
      throw new Error("Failed to create a seeded team user.");
    }

    createdUsers.push(user);

    const assignedBranches =
      role === "accountant"
        ? branchList
        : sampleManyDistinct(branchList, randomInt(1, 2, rng), rng);

    if (assignedBranches.length) {
      await db
        .insert(userBranches)
        .values(
          assignedBranches.map((branch) => ({
            shopId,
            userId: user.id,
            branchId: branch.id,
          })),
        )
        .onConflictDoNothing();
    }
  }

  return createdUsers;
};

const seedCategories = async (
  shopId: string,
  args: SeedArgs,
) => {
  const medicinesService = new MedicinesService();
  const created: Array<{ id: string; name: string }> = [];

  for (let index = 0; index < CATEGORY_TARGET; index += 1) {
    const label = categoryCatalog[index % categoryCatalog.length]!;
    const category = await medicinesService.createCategory(shopId, {
      name: `${label} ${index + 1} ${args.tag}`.slice(0, 120),
      description: `Seeded category ${index + 1} for ${args.tag}`,
      status: "active",
    });
    created.push({
      id: category.id,
      name: category.name,
    });
  }

  return created;
};

const seedManufacturers = async (
  shopId: string,
  args: SeedArgs,
) => {
  const medicinesService = new MedicinesService();
  const created: Array<{ id: string; name: string }> = [];

  for (let index = 0; index < MANUFACTURER_TARGET; index += 1) {
    const label = manufacturerCatalog[index % manufacturerCatalog.length]!;
    const manufacturer = await medicinesService.createManufacturer(shopId, {
      name: `${label} ${index + 1} ${args.tag}`.slice(0, 160),
      status: "active",
    });
    created.push({
      id: manufacturer.id,
      name: manufacturer.name,
    });
  }

  return created;
};

const seedMedicines = async (
  shopId: string,
  count: number,
  args: SeedArgs,
  categoriesList: Array<{ id: string; name: string }>,
  manufacturersList: Array<{ id: string; name: string }>,
  rng: () => number,
) => {
  const medicinesService = new MedicinesService();
  const created: SeedMedicine[] = [];
  const tagNumber = buildSeedNumber(args.tag);

  for (let index = 0; index < count; index += 1) {
    const catalog = medicineCatalog[index % medicineCatalog.length]!;
    const category = categoriesList[index % categoriesList.length]!;
    const manufacturer = manufacturersList[index % manufacturersList.length]!;
    const gstPercent = [0, 5, 12, 18][index % 4] ?? 0;
    const basePurchaseRate = roundMoney(22 + (index % 9) * 14 + rng() * 18);
    const baseSaleRate = roundMoney(basePurchaseRate * (1.12 + (index % 4) * 0.05));
    const baseMrp = roundMoney(baseSaleRate * (1.04 + (index % 3) * 0.03));
    const strength = strengths[index % strengths.length]!;
    const brandName = `${catalog.name} ${titleCase(sample(lastNames, rng))}`.slice(0, 160);

    const medicine = await medicinesService.createMedicine(shopId, {
      medicineName: `${catalog.name} ${index + 1} ${args.tag}`.slice(0, 180),
      genericName: catalog.generic,
      brandName,
      strength,
      form: catalog.form,
      unit: catalog.unit,
      categoryId: category.id,
      manufacturerId: manufacturer.id,
      hsnCode: `${3000 + ((tagNumber + index) % 4000)}`,
      gstPercent,
      barcode: `${890000000000 + tagNumber * 10 + index}`,
      reorderLevel: 8 + (index % 7) * 3,
      prescriptionRequired: index % 5 === 0,
      notes: `Seeded medicine ${index + 1} for ${args.tag}`,
      status: "active",
    });

    created.push({
      id: medicine.id,
      medicineName: medicine.medicineName,
      genericName: medicine.genericName,
      gstPercent,
      reorderLevel: medicine.reorderLevel,
      form: medicine.form as SeedMedicine["form"],
      unit: medicine.unit as SeedMedicine["unit"],
      basePurchaseRate,
      baseSaleRate,
      baseMrp,
    });
  }

  return created;
};

const seedSuppliers = async (
  shopId: string,
  count: number,
  args: SeedArgs,
  rng: () => number,
) => {
  const suppliersService = new SuppliersService();
  const created: SeedSupplier[] = [];
  const tagNumber = buildSeedNumber(args.tag);

  for (let index = 0; index < count; index += 1) {
    const city = sample(cities, rng);
    const state = sample(states, rng);
    const supplierName = `${titleCase(sample(firstNames, rng))} ${titleCase(sample(lastNames, rng))} Distributors ${index + 1}`;
    const companyName = `${titleCase(sample(lastNames, rng))} Pharma Traders ${index + 1}`;
    const supplier = await suppliersService.createSupplier(shopId, {
      supplierName,
      companyName,
      contactPerson: `${titleCase(sample(firstNames, rng))} ${titleCase(sample(lastNames, rng))}`,
      mobileNumber: toPhone(tagNumber + 2000000 + index),
      alternateMobileNumber: toPhone(tagNumber + 3000000 + index),
      email: `supplier.${args.tag}.${index + 1}@seed-mms.local`,
      gstNumber: toGst(tagNumber + index),
      drugLicenseNumber: `DL-${args.tag}-${1000 + index}`,
      addressLine1: `${10 + (index % 90)}, ${city} medical lane`,
      addressLine2: "Wholesale market",
      city,
      state,
      pincode: toPincode(tagNumber + index),
      openingBalance: index % 6 === 0 ? formatAmount(500 + index * 13).toFixed(2) : "0.00",
      notes: `Seeded supplier ${index + 1} for ${args.tag}`,
      status: "active",
    });
    created.push({
      id: supplier.id,
      supplierName: supplier.supplierName,
    });
  }

  return created;
};

const seedCustomers = async (
  shopId: string,
  count: number,
  args: SeedArgs,
  rng: () => number,
) => {
  const customersService = new CustomersService();
  const created: SeedCustomer[] = [];
  const tagNumber = buildSeedNumber(args.tag);

  for (let index = 0; index < count; index += 1) {
    const firstName = titleCase(sample(firstNames, rng));
    const lastName = titleCase(sample(lastNames, rng));
    const city = sample(cities, rng);
    const state = sample(states, rng);
    const age = randomInt(18, 72, rng);
    const customer = await customersService.createCustomer(shopId, {
      fullName: `${firstName} ${lastName}`,
      mobileNumber: toPhone(tagNumber + 4000000 + index),
      alternateMobileNumber:
        index % 5 === 0 ? toPhone(tagNumber + 5000000 + index) : undefined,
      email: `customer.${args.tag}.${index + 1}@seed-mms.local`,
      gender: (["male", "female", "other"][index % 3] ?? "male") as
        | "male"
        | "female"
        | "other",
      age,
      dateOfBirth: addDays(new Date(), -(age * 365 + randomInt(10, 280, rng))),
      addressLine1: `${50 + (index % 70)}, ${city} colony`,
      addressLine2: "Near city clinic",
      city,
      state,
      pincode: toPincode(tagNumber + 6000000 + index),
      notes: `Seeded customer ${index + 1} for ${args.tag}`,
      status: "active",
    });
    created.push({
      id: customer.id,
      fullName: customer.fullName,
    });
  }

  return created;
};

const choosePurchaseDate = (index: number, rng: () => number) =>
  randomDateBetween(addDays(new Date(), -220), addDays(new Date(), -8), rng);

const chooseExpiryDate = (purchaseDate: Date, index: number, rng: () => number) => {
  if (index % 8 === 0) {
    return addDays(purchaseDate, randomInt(45, 140, rng));
  }

  if (index % 5 === 0) {
    return addDays(new Date(), randomInt(4, 24, rng));
  }

  return addDays(new Date(), randomInt(45, 360, rng));
};

const seedPurchases = async (
  shopId: string,
  count: number,
  args: SeedArgs,
  branchList: SeedBranch[],
  actorAdmin: PublicUser,
  seededUsers: SeedUser[],
  supplierList: SeedSupplier[],
  medicineList: SeedMedicine[],
  rng: () => number,
) => {
  const purchasesService = new PurchasesService();
  const created: Array<{
    id: string;
    supplierId: string;
    branchId: string;
    dueAmount: number;
  }> = [];

  for (let index = 0; index < count; index += 1) {
    const actor = pickRoleActor(actorAdmin, seededUsers, "admin", rng);
    const branch = branchList[index % branchList.length]!;
    const supplier = supplierList[index % supplierList.length]!;
    const purchaseDate = choosePurchaseDate(index, rng);
    const selectedMedicines = sampleManyDistinct(
      medicineList,
      randomInt(2, 4, rng),
      rng,
    );

    const items = selectedMedicines.map((medicine, itemIndex) => {
      const purchaseRate = roundMoney(
        medicine.basePurchaseRate * (0.92 + rng() * 0.22),
      );
      const saleRate = roundMoney(
        Math.max(medicine.baseSaleRate, purchaseRate * (1.12 + rng() * 0.18)),
      );
      const mrp = roundMoney(
        Math.max(medicine.baseMrp, saleRate * (1.03 + rng() * 0.08)),
      );
      const quantity = randomInt(18, 90, rng);

      return {
        medicineId: medicine.id,
        batchNumber: `PB-${args.tag}-${index + 1}-${itemIndex + 1}`.slice(0, 80),
        expiryDate: chooseExpiryDate(purchaseDate, index + itemIndex, rng),
        quantity,
        freeQuantity: randomInt(0, 6, rng),
        purchaseRate,
        saleRate,
        mrp,
        gstPercent: medicine.gstPercent,
        discountPercent: index % 6 === 0 ? randomInt(2, 8, rng) : 0,
      };
    });

    const subtotal = items.reduce(
      (sum, item) => sum + item.purchaseRate * item.quantity,
      0,
    );
    const paidAmount =
      index % 5 === 0
        ? roundMoney(subtotal * 0.25)
        : index % 3 === 0
          ? roundMoney(subtotal * 0.55)
          : index % 7 === 0
            ? roundMoney(subtotal)
            : 0;

    const draft = await purchasesService.createPurchase(
      shopId,
      branch.id,
      actor.id,
      {
        supplierId: supplier.id,
        supplierInvoiceNumber: `SUP-${args.tag}-${index + 1}`,
        supplierInvoiceDate: addDays(purchaseDate, -randomInt(0, 4, rng)),
        purchaseDate,
        paidAmount,
        roundOffAmount: index % 4 === 0 ? -0.2 : 0,
        notes: `Seed purchase ${index + 1} for ${args.tag}`,
        items,
      },
    );

    const finalized = await purchasesService.finalizePurchase(
      shopId,
      branch.id,
      draft.id,
      actor.id,
    );

    created.push({
      id: finalized.id,
      supplierId: finalized.supplier.id,
      branchId: branch.id,
      dueAmount: Number(finalized.dueAmount),
    });
  }

  return created;
};

const seedPurchaseReturns = async (
  shopId: string,
  count: number,
  args: SeedArgs,
  actorAdmin: PublicUser,
  seededUsers: SeedUser[],
  purchaseIds: string[],
  rng: () => number,
) => {
  const purchaseReturnsService = new PurchaseReturnsService();
  let created = 0;

  for (const purchaseId of purchaseIds) {
    if (created >= count) {
      break;
    }

    const actor = pickRoleActor(actorAdmin, seededUsers, "admin", rng);
    const detail = await purchaseReturnsService.getReturnablePurchaseDetail(
      shopId,
      purchaseId,
    );
    const candidates = detail.items.filter((item) => item.maxReturnableQuantity > 0);

    if (!candidates.length) {
      continue;
    }

    const selectedItems = sampleManyDistinct(
      candidates,
      clamp(randomInt(1, 2, rng), 1, candidates.length),
      rng,
    ).map((item, index) => ({
      purchaseItemId: item.purchaseItemId,
      quantity: clamp(
        randomInt(1, Math.max(1, Math.min(item.maxReturnableQuantity, 8)), rng),
        1,
        item.maxReturnableQuantity,
      ),
      reason: PURCHASE_RETURN_REASONS[(created + index) % PURCHASE_RETURN_REASONS.length] ?? "other",
      notes: `Seed purchase return ${created + 1} for ${args.tag}`,
    }));

    const draft = await purchaseReturnsService.createDraftPurchaseReturn(
      shopId,
      actor.id,
      {
        purchaseId,
        notes: `Seed purchase return ${created + 1} for ${args.tag}`,
        items: selectedItems,
      },
    );

    await purchaseReturnsService.completePurchaseReturn(shopId, draft.id, actor.id);
    created += 1;
  }

  return created;
};

const seedSupplierPayments = async (
  shopId: string,
  count: number,
  args: SeedArgs,
  actorAdmin: PublicUser,
  seededUsers: SeedUser[],
  rng: () => number,
) => {
  const accountingRepository = new AccountingRepository();
  const accountingService = new AccountingService();
  const purchaseRows = await db
    .select({
      id: purchases.id,
      supplierId: purchases.supplierId,
    })
    .from(purchases)
    .where(and(eq(purchases.shopId, shopId), eq(purchases.status, "finalized")))
    .orderBy(purchases.purchaseDate);

  let created = 0;

  for (const row of purchaseRows) {
    if (created >= count) {
      break;
    }

    const [openPurchase] = await accountingRepository.listOpenPurchasesForSupplier(
      shopId,
      row.supplierId,
    );

    const matching = openPurchase?.purchase.id === row.id
      ? openPurchase
      : (
          await accountingRepository.listOpenPurchasesForSupplier(shopId, row.supplierId)
        ).find((entry) => entry.purchase.id === row.id);

    if (!matching) {
      continue;
    }

    const openDue = Number(matching.openDue);
    if (openDue <= 0) {
      continue;
    }

    const actor = pickRoleActor(actorAdmin, seededUsers, "accountant", rng);
    const amount =
      created % 4 === 0
        ? roundMoney(openDue)
        : roundMoney(Math.max(1, openDue * (0.25 + rng() * 0.45)));

    await accountingService.createSupplierPayment(shopId, actor.id, {
      supplierId: row.supplierId,
      purchaseId: row.id,
      amount: Math.min(amount, openDue),
      paymentMethod:
        CUSTOMER_PAYMENT_METHODS[created % CUSTOMER_PAYMENT_METHODS.length] ?? "cash",
      referenceNumber: `SPAY-${args.tag}-${created + 1}`,
      notes: `Seed supplier payment ${created + 1} for ${args.tag}`,
      paymentDate: randomDateBetween(addDays(new Date(), -90), new Date(), rng),
    });
    created += 1;
  }

  return created;
};

const loadSellableInventory = async (shopId: string) => {
  const today = new Date();

  return db
    .select({
      branchId: medicineBatches.branchId,
      medicineId: medicineBatches.medicineId,
      availableQuantity: sql<number>`sum(${medicineBatches.quantityAvailable})`.mapWith(Number),
    })
    .from(medicineBatches)
    .where(
      and(
        eq(medicineBatches.shopId, shopId),
        isNotNull(medicineBatches.branchId),
        eq(medicineBatches.status, "active"),
        gt(medicineBatches.quantityAvailable, 0),
        gt(medicineBatches.expiryDate, today),
      ),
    )
    .groupBy(medicineBatches.branchId, medicineBatches.medicineId);
};

const seedSales = async (
  shopId: string,
  count: number,
  args: SeedArgs,
  branchList: SeedBranch[],
  actorAdmin: PublicUser,
  seededUsers: SeedUser[],
  customerList: SeedCustomer[],
  medicineList: SeedMedicine[],
  rng: () => number,
) => {
  const billingService = new BillingService();
  const availabilityRows = await loadSellableInventory(shopId);
  const availabilityMap = new Map<string, number>();

  for (const row of availabilityRows) {
    if (row.branchId) {
      availabilityMap.set(`${row.branchId}:${row.medicineId}`, row.availableQuantity);
    }
  }

  const created: Array<{
    id: string;
    customerId: string | null;
    dueAmount: number;
  }> = [];

  for (let index = 0; index < count; index += 1) {
    const branch = branchList[index % branchList.length]!;
    const actor = pickRoleActor(actorAdmin, seededUsers, "staff", rng);
    const candidates = medicineList.filter((medicine) => {
      const quantity = availabilityMap.get(`${branch.id}:${medicine.id}`) ?? 0;
      return quantity > 4;
    });

    if (!candidates.length) {
      continue;
    }

    const selectedMedicines = sampleManyDistinct(
      candidates,
      clamp(randomInt(1, 4, rng), 1, candidates.length),
      rng,
    );
    const useWalkIn = index % 6 === 0;
    const customer = useWalkIn
      ? undefined
      : customerList[index % customerList.length]!;

    const items = selectedMedicines.map((medicine) => {
      const key = `${branch.id}:${medicine.id}`;
      const available = availabilityMap.get(key) ?? 0;
      const quantity = clamp(randomInt(1, Math.min(available, 6), rng), 1, available);
      availabilityMap.set(key, available - quantity);

      return {
        medicineId: medicine.id,
        quantity,
        discountPercent: index % 7 === 0 ? randomInt(3, 12, rng) : 0,
      };
    });

    const fullPayment = useWalkIn || index % 5 === 0;
    const estimatedTotal = items.reduce(
      (sum, item) =>
        sum +
        (medicineList.find((medicine) => medicine.id === item.medicineId)?.baseSaleRate ??
          50) *
          item.quantity,
      0,
    );
    const paidAmount = fullPayment
      ? roundMoney(estimatedTotal * 1.12)
      : index % 3 === 0
        ? roundMoney(estimatedTotal * 0.55)
        : 0;

    const sale = await billingService.createCompletedBill(shopId, branch.id, actor.id, {
      customerId: customer?.id,
      customerName: customer
        ? undefined
        : `Walk-in ${index + 1} ${args.tag}`.slice(0, 160),
      customerPhone: customer
        ? undefined
        : toPhone(buildSeedNumber(args.tag) + 7000000 + index),
      paymentMethod: SALE_PAYMENT_METHODS[index % SALE_PAYMENT_METHODS.length] ?? "cash",
      paidAmount,
      roundOffAmount: index % 4 === 0 ? -0.1 : 0,
      notes: `Seed bill ${index + 1} for ${args.tag}`,
      items,
    });

    created.push({
      id: sale.id,
      customerId: sale.customerId ?? null,
      dueAmount: Number(sale.dueAmount),
    });
  }

  return created;
};

const seedSalesReturns = async (
  shopId: string,
  count: number,
  args: SeedArgs,
  actorAdmin: PublicUser,
  seededUsers: SeedUser[],
  saleIds: string[],
  rng: () => number,
) => {
  const salesReturnsService = new SalesReturnsService();
  let created = 0;

  for (const saleId of saleIds) {
    if (created >= count) {
      break;
    }

    const detail = await salesReturnsService.getReturnableSaleDetail(shopId, saleId);
    const candidates = detail.items.filter((item) => item.remainingReturnableQuantity > 0);

    if (!candidates.length) {
      continue;
    }

    const selectedItems = sampleManyDistinct(
      candidates,
      clamp(randomInt(1, 2, rng), 1, candidates.length),
      rng,
    );
    const items = selectedItems.map((item, index) => ({
      saleItemId: item.saleItemId,
      quantity: clamp(
        randomInt(1, Math.min(item.remainingReturnableQuantity, 3), rng),
        1,
        item.remainingReturnableQuantity,
      ),
      reason: SALES_RETURN_REASONS[(created + index) % SALES_RETURN_REASONS.length] ?? "Billing correction",
      notes: `Seed sales return ${created + 1} for ${args.tag}`,
    }));
    const estimatedRefund = roundMoney(
      selectedItems.reduce((sum, item, index) => {
        const unitValue = Number(item.lineTotal) / Math.max(item.quantitySold, 1);
        return sum + unitValue * items[index]!.quantity;
      }, 0),
    );
    const refundStatus =
      detail.sale.customerId && Number(detail.sale.paidAmount) > 0
        ? ("processed" as const)
        : ("not_required" as const);
    const actorRole: "admin" | "staff" =
      created % 2 === 0 ? "staff" : "admin";
    const actor = pickRoleActor(actorAdmin, seededUsers, actorRole, rng);

    const draft = await salesReturnsService.createDraftSalesReturn(
      shopId,
      actor.id,
      actor.role,
      {
        saleId,
        refundAmount: refundStatus === "processed" ? estimatedRefund : 0,
        refundMethod: refundStatus === "processed" ? "cash" : undefined,
        refundStatus,
        notes: `Seed sales return ${created + 1} for ${args.tag}`,
        items,
      },
    );

    await salesReturnsService.completeSalesReturn(shopId, draft.id, actor.id, actor.role);
    created += 1;
  }

  return created;
};

const seedCustomerPayments = async (
  shopId: string,
  count: number,
  args: SeedArgs,
  actorAdmin: PublicUser,
  seededUsers: SeedUser[],
  rng: () => number,
) => {
  const accountingRepository = new AccountingRepository();
  const accountingService = new AccountingService();
  const saleRows = await db
    .select({
      id: sales.id,
      customerId: sales.customerId,
    })
    .from(sales)
    .where(and(eq(sales.shopId, shopId), eq(sales.status, "completed"), isNotNull(sales.customerId)))
    .orderBy(desc(sales.completedAt), desc(sales.createdAt));

  let created = 0;

  for (const row of saleRows) {
    if (created >= count || !row.customerId) {
      break;
    }

    const matching = (
      await accountingRepository.listOpenSalesForCustomer(shopId, row.customerId)
    ).find((entry) => entry.sale.id === row.id);

    if (!matching) {
      continue;
    }

    const openDue = Number(matching.openDue);
    if (openDue <= 0) {
      continue;
    }

    const actor = pickRoleActor(actorAdmin, seededUsers, "accountant", rng);
    const amount =
      created % 4 === 0
        ? roundMoney(openDue)
        : roundMoney(Math.max(1, openDue * (0.22 + rng() * 0.48)));

    await accountingService.createCustomerPayment(shopId, actor.id, {
      customerId: row.customerId,
      saleId: row.id,
      amount: Math.min(amount, openDue),
      paymentMethod:
        CUSTOMER_PAYMENT_METHODS[created % CUSTOMER_PAYMENT_METHODS.length] ?? "cash",
      referenceNumber: `CPAY-${args.tag}-${created + 1}`,
      notes: `Seed customer payment ${created + 1} for ${args.tag}`,
      paymentDate: randomDateBetween(addDays(new Date(), -90), new Date(), rng),
    });
    created += 1;
  }

  return created;
};

const loadTransferCandidates = async (shopId: string) => {
  const today = new Date();

  return db
    .select({
      id: medicineBatches.id,
      branchId: medicineBatches.branchId,
      medicineId: medicineBatches.medicineId,
      quantityAvailable: medicineBatches.quantityAvailable,
    })
    .from(medicineBatches)
    .where(
      and(
        eq(medicineBatches.shopId, shopId),
        isNotNull(medicineBatches.branchId),
        eq(medicineBatches.status, "active"),
        gt(medicineBatches.quantityAvailable, 4),
        gt(medicineBatches.expiryDate, today),
      ),
    )
    .orderBy(desc(medicineBatches.updatedAt))
    .limit(250);
};

const seedStockTransfers = async (
  shopId: string,
  count: number,
  actorAdmin: PublicUser,
  branchList: SeedBranch[],
  rng: () => number,
) => {
  if (branchList.length < 2) {
    return 0;
  }

  const stockTransfersService = new StockTransfersService();
  let created = 0;

  while (created < count) {
    const candidates = await loadTransferCandidates(shopId);
    if (!candidates.length) {
      break;
    }

    const candidate = sample(candidates, rng);
    if (!candidate?.branchId) {
      break;
    }

    const destinations = branchList.filter((branch) => branch.id !== candidate.branchId);
    if (!destinations.length) {
      break;
    }

    const quantity = clamp(
      randomInt(1, Math.min(candidate.quantityAvailable - 1, 8), rng),
      1,
      Math.max(1, candidate.quantityAvailable - 1),
    );
    const transfer = await stockTransfersService.createTransfer(
      shopId,
      {
        fromBranchId: candidate.branchId,
        toBranchId: sample(destinations, rng)!.id,
        notes: `Seed stock transfer ${created + 1}`,
        items: [
          {
            sourceBatchId: candidate.id,
            medicineId: candidate.medicineId,
            quantity,
          },
        ],
      },
      actorAdmin,
    );

    await stockTransfersService.completeTransfer(shopId, transfer.id, actorAdmin);
    created += 1;
  }

  return created;
};

const loadAdjustmentCandidates = async (shopId: string) => {
  return db
    .select({
      batchId: medicineBatches.id,
      branchId: medicineBatches.branchId,
      medicineId: medicineBatches.medicineId,
      quantityAvailable: medicineBatches.quantityAvailable,
    })
    .from(medicineBatches)
    .where(
      and(
        eq(medicineBatches.shopId, shopId),
        isNotNull(medicineBatches.branchId),
        gt(medicineBatches.quantityAvailable, 0),
      ),
    )
    .orderBy(desc(medicineBatches.updatedAt))
    .limit(300);
};

const seedStockAdjustments = async (
  shopId: string,
  count: number,
  actorAdmin: PublicUser,
  seededUsers: SeedUser[],
  args: SeedArgs,
  rng: () => number,
) => {
  const inventoryService = new InventoryService();
  let created = 0;

  while (created < count) {
    const candidates = await loadAdjustmentCandidates(shopId);
    if (!candidates.length) {
      break;
    }

    const candidate = sample(candidates, rng);
    if (!candidate?.branchId) {
      break;
    }

    const adjustmentType =
      candidate.quantityAvailable > 6 && created % 3 !== 0 ? "out" : "in";
    const maxQuantity =
      adjustmentType === "out"
        ? Math.max(1, Math.min(candidate.quantityAvailable, 5))
        : 6;
    const quantity = randomInt(1, maxQuantity, rng);
    const actor = pickRoleActor(actorAdmin, seededUsers, "staff", rng);

    await inventoryService.createStockAdjustment(
      shopId,
      candidate.branchId,
      actor.id,
      {
        medicineId: candidate.medicineId,
        batchId: candidate.batchId,
        adjustmentType,
        quantity,
        reason:
          adjustmentType === "in"
            ? "Seed stock correction in"
            : "Seed stock correction out",
        notes: `Seed stock adjustment ${created + 1} for ${args.tag}`,
      },
    );
    created += 1;
  }

  return created;
};

const seedNotifications = async (
  shopId: string,
  count: number,
  branchList: SeedBranch[],
  args: SeedArgs,
  rng: () => number,
) => {
  const alertsService = new AlertsService();
  const notificationsRepository = new NotificationsRepository();

  for (const branch of branchList) {
    await alertsService.syncShopAlerts(shopId, branch.id);
  }

  const [notificationRow] = await db
    .select({
      total: countRows(notifications.id),
    })
    .from(notifications)
    .where(eq(notifications.shopId, shopId));

  const existingTotal = Number(notificationRow?.total ?? 0);
  const toCreate = Math.max(count - existingTotal, 0);

  for (let index = 0; index < toCreate; index += 1) {
    await notificationsRepository.createNotification({
      shopId,
      branchId: sample(branchList, rng)?.id,
      type: "system_alert",
      title: `Seeded system alert ${index + 1}`,
      message: `Seed run ${args.tag} created this system notification for dashboard and notification-center testing.`,
      severity: index % 4 === 0 ? "critical" : index % 2 === 0 ? "warning" : "info",
      entityType: "system",
      conditionKey: `seed_system_alert:${args.tag}:${index + 1}:${randomUUID()}`,
      metadata: {
        actionPath: "/app/notifications",
        seedTag: args.tag,
      },
      deliveryChannels: ["in_app"],
      emailStatus: "skipped",
      isActive: true,
    });
  }
};

const main = async () => {
  const args = parseArgs();
  const rng = createRng(args.tag);

  console.log(`Starting project seed for tag "${args.tag}" with count ${args.count}.`);

  const target = await findTargetAdmin(args);
  await ensureTestingShopSettings(target.shop.id);

  const adminActor = await toPublicActor(target.user);
  const branchList = await ensureBranches(target.shop.id, adminActor, rng);
  const seededUsers = await ensureSeedUsers(target.shop.id, branchList, args, rng);
  const categoriesList = await seedCategories(target.shop.id, args);
  const manufacturersList = await seedManufacturers(target.shop.id, args);
  const medicineList = await seedMedicines(
    target.shop.id,
    args.count,
    args,
    categoriesList,
    manufacturersList,
    rng,
  );
  const supplierList = await seedSuppliers(target.shop.id, args.count, args, rng);
  const customerList = await seedCustomers(target.shop.id, args.count, args, rng);
  const purchaseList = await seedPurchases(
    target.shop.id,
    args.count,
    args,
    branchList,
    adminActor,
    seededUsers,
    supplierList,
    medicineList,
    rng,
  );
  const purchaseReturnCount = await seedPurchaseReturns(
    target.shop.id,
    args.count,
    args,
    adminActor,
    seededUsers,
    purchaseList.map((purchase) => purchase.id),
    rng,
  );
  const supplierPaymentCount = await seedSupplierPayments(
    target.shop.id,
    args.count,
    args,
    adminActor,
    seededUsers,
    rng,
  );
  const saleList = await seedSales(
    target.shop.id,
    args.count,
    args,
    branchList,
    adminActor,
    seededUsers,
    customerList,
    medicineList,
    rng,
  );
  const salesReturnCount = await seedSalesReturns(
    target.shop.id,
    args.count,
    args,
    adminActor,
    seededUsers,
    saleList.map((sale) => sale.id),
    rng,
  );
  const customerPaymentCount = await seedCustomerPayments(
    target.shop.id,
    args.count,
    args,
    adminActor,
    seededUsers,
    rng,
  );
  const transferCount = await seedStockTransfers(
    target.shop.id,
    args.count,
    adminActor,
    branchList,
    rng,
  );
  const adjustmentCount = await seedStockAdjustments(
    target.shop.id,
    args.count,
    adminActor,
    seededUsers,
    args,
    rng,
  );
  await seedNotifications(target.shop.id, args.count, branchList, args, rng);

  const [notificationTotal] = await db
    .select({
      total: countRows(notifications.id),
    })
    .from(notifications)
    .where(eq(notifications.shopId, target.shop.id));

  console.log("Seed completed successfully.");
  console.log(
    JSON.stringify(
      {
        shop: {
          id: target.shop.id,
          name: target.shop.name,
          adminEmail: target.user.email,
        },
        loginPasswordForSeededUsers: DEFAULT_USER_PASSWORD,
        created: {
          branches: branchList.length,
          teamUsers: seededUsers.length,
          categories: categoriesList.length,
          manufacturers: manufacturersList.length,
          medicines: medicineList.length,
          suppliers: supplierList.length,
          customers: customerList.length,
          purchases: purchaseList.length,
          purchaseReturns: purchaseReturnCount,
          supplierPayments: supplierPaymentCount,
          sales: saleList.length,
          salesReturns: salesReturnCount,
          customerPayments: customerPaymentCount,
          stockTransfers: transferCount,
          stockAdjustments: adjustmentCount,
          notifications: Number(notificationTotal?.total ?? 0),
        },
      },
      null,
      2,
    ),
  );
};

void main()
  .catch((error) => {
    console.error("Project seed failed.");
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
