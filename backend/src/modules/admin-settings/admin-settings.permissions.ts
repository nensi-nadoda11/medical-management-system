import type { UserRole } from "../auth/auth.types";

export const PERMISSIONS = [
  "medicines.view",
  "medicines.create",
  "medicines.edit",
  "suppliers.view",
  "suppliers.create",
  "suppliers.edit",
  "purchases.view",
  "purchases.create",
  "purchases.finalize",
  "purchaseReturns.view",
  "purchaseReturns.create",
  "purchaseReturns.complete",
  "inventory.view",
  "inventory.adjust",
  "billing.view",
  "billing.create",
  "billing.complete",
  "billing.return",
  "reports.view",
  "reports.financial",
  "customers.view",
  "customers.create",
  "customers.edit",
  "payments.view",
  "payments.create",
  "shop.view",
  "shop.manage",
  "users.view",
  "users.manage",
  "settings.view",
  "settings.manage",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

type PermissionCatalogItem = {
  key: PermissionKey;
  group:
    | "medicines"
    | "suppliers"
    | "purchases"
    | "purchaseReturns"
    | "inventory"
    | "billing"
    | "reports"
    | "customers"
    | "payments"
    | "shop"
    | "users"
    | "settings";
  label: string;
  description: string;
};

export const PERMISSION_CATALOG: PermissionCatalogItem[] = [
  {
    key: "medicines.view",
    group: "medicines",
    label: "View medicines",
    description: "Browse medicine master data and details.",
  },
  {
    key: "medicines.create",
    group: "medicines",
    label: "Create medicines",
    description: "Add new medicines and related master records.",
  },
  {
    key: "medicines.edit",
    group: "medicines",
    label: "Edit medicines",
    description: "Update medicine master records and statuses.",
  },
  {
    key: "suppliers.view",
    group: "suppliers",
    label: "View suppliers",
    description: "Browse supplier records and details.",
  },
  {
    key: "suppliers.create",
    group: "suppliers",
    label: "Create suppliers",
    description: "Add new supplier records.",
  },
  {
    key: "suppliers.edit",
    group: "suppliers",
    label: "Edit suppliers",
    description: "Update supplier records and statuses.",
  },
  {
    key: "purchases.view",
    group: "purchases",
    label: "View purchases",
    description: "Browse purchase drafts, finalized purchases, and detail pages.",
  },
  {
    key: "purchases.create",
    group: "purchases",
    label: "Create purchases",
    description: "Create and edit draft purchase entries.",
  },
  {
    key: "purchases.finalize",
    group: "purchases",
    label: "Finalize purchases",
    description: "Finalize or cancel draft purchases.",
  },
  {
    key: "purchaseReturns.view",
    group: "purchaseReturns",
    label: "View purchase returns",
    description: "Browse purchase return drafts, completed returns, and detail pages.",
  },
  {
    key: "purchaseReturns.create",
    group: "purchaseReturns",
    label: "Create purchase returns",
    description: "Create and edit draft purchase return entries.",
  },
  {
    key: "purchaseReturns.complete",
    group: "purchaseReturns",
    label: "Complete purchase returns",
    description: "Complete or cancel draft purchase returns with stock and payable impact.",
  },
  {
    key: "inventory.view",
    group: "inventory",
    label: "View inventory",
    description: "View stock summaries, low-stock lists, and batch details.",
  },
  {
    key: "inventory.adjust",
    group: "inventory",
    label: "Adjust inventory",
    description: "Create manual stock adjustments.",
  },
  {
    key: "billing.view",
    group: "billing",
    label: "View billing",
    description: "Access billing history, held bills, and POS lookup flows.",
  },
  {
    key: "billing.create",
    group: "billing",
    label: "Create bills",
    description: "Create and update held bills.",
  },
  {
    key: "billing.complete",
    group: "billing",
    label: "Complete bills",
    description: "Finalize bills and post stock movement.",
  },
  {
    key: "billing.return",
    group: "billing",
    label: "Manage sales returns",
    description: "Create, complete, and review billing return workflows.",
  },
  {
    key: "reports.view",
    group: "reports",
    label: "View reports",
    description: "Access dashboard and operational sales reporting.",
  },
  {
    key: "reports.financial",
    group: "reports",
    label: "View financial reports",
    description: "Access profit, stock, low-stock, expiry, and supplier reports.",
  },
  {
    key: "customers.view",
    group: "customers",
    label: "View customers",
    description: "Browse customer records, summaries, and activity.",
  },
  {
    key: "customers.create",
    group: "customers",
    label: "Create customers",
    description: "Add new customer records.",
  },
  {
    key: "customers.edit",
    group: "customers",
    label: "Edit customers",
    description: "Update customer records and statuses.",
  },
  {
    key: "payments.view",
    group: "payments",
    label: "View payments",
    description: "Review customer and supplier dues, ledgers, and payments.",
  },
  {
    key: "payments.create",
    group: "payments",
    label: "Record payments",
    description: "Create customer and supplier payment entries.",
  },
  {
    key: "shop.view",
    group: "shop",
    label: "View shop setup",
    description: "Open shop setup and profile details.",
  },
  {
    key: "shop.manage",
    group: "shop",
    label: "Manage shop setup",
    description: "Update shop profile and commercial setup details.",
  },
  {
    key: "users.view",
    group: "users",
    label: "View users",
    description: "View staff users and invitation activity.",
  },
  {
    key: "users.manage",
    group: "users",
    label: "Manage users",
    description: "Invite users and change user access or status.",
  },
  {
    key: "settings.view",
    group: "settings",
    label: "View admin settings",
    description: "Open operational settings, permissions, and audit history.",
  },
  {
    key: "settings.manage",
    group: "settings",
    label: "Manage admin settings",
    description: "Update operational settings and permissions.",
  },
] satisfies PermissionCatalogItem[];

const PERMISSION_DEPENDENCIES: Partial<Record<PermissionKey, PermissionKey[]>> = {
  "medicines.create": ["medicines.view"],
  "medicines.edit": ["medicines.view"],
  "suppliers.create": ["suppliers.view"],
  "suppliers.edit": ["suppliers.view"],
  "purchases.create": ["purchases.view"],
  "purchases.finalize": ["purchases.view"],
  "purchaseReturns.create": ["purchaseReturns.view", "purchases.view"],
  "purchaseReturns.complete": ["purchaseReturns.view"],
  "inventory.adjust": ["inventory.view"],
  "billing.create": ["billing.view"],
  "billing.complete": ["billing.view"],
  "billing.return": ["billing.view"],
  "reports.financial": ["reports.view"],
  "customers.create": ["customers.view"],
  "customers.edit": ["customers.view"],
  "payments.create": ["payments.view"],
  "shop.manage": ["shop.view"],
  "users.manage": ["users.view"],
  "settings.manage": ["settings.view"],
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  admin: [...PERMISSIONS],
  staff: [
    "billing.view",
    "billing.create",
    "billing.complete",
    "billing.return",
    "reports.view",
    "customers.view",
    "customers.create",
    "customers.edit",
    "payments.view",
  ],
  accountant: [
    "purchaseReturns.view",
    "billing.view",
    "billing.return",
    "reports.view",
    "reports.financial",
    "customers.view",
    "payments.view",
    "payments.create",
  ],
};

export const ESSENTIAL_ADMIN_PERMISSIONS: PermissionKey[] = [
  "shop.view",
  "shop.manage",
  "users.view",
  "users.manage",
  "settings.view",
  "settings.manage",
];

const permissionOrder = new Map(PERMISSIONS.map((permission, index) => [permission, index]));

export const isPermissionKey = (value: string): value is PermissionKey =>
  PERMISSIONS.includes(value as PermissionKey);

export const expandPermissionDependencies = (
  permissions: Iterable<PermissionKey>,
) => {
  const expanded = new Set<PermissionKey>();

  const visit = (permission: PermissionKey) => {
    if (expanded.has(permission)) {
      return;
    }

    const dependencies = PERMISSION_DEPENDENCIES[permission] ?? [];
    dependencies.forEach(visit);
    expanded.add(permission);
  };

  [...permissions].forEach(visit);

  return [...expanded].sort(
    (left, right) =>
      (permissionOrder.get(left) ?? 0) - (permissionOrder.get(right) ?? 0),
  );
};

export const normalizePermissionSet = (permissions: Iterable<string>) =>
  expandPermissionDependencies(
    [...new Set([...permissions].filter(isPermissionKey))] as PermissionKey[],
  );

export const resolveEffectivePermissions = (input: {
  rolePermissions: PermissionKey[];
  allow: PermissionKey[];
  deny: PermissionKey[];
}) => {
  const effective = new Set<PermissionKey>(
    expandPermissionDependencies([...input.rolePermissions, ...input.allow]),
  );

  input.deny.forEach((permission) => {
    effective.delete(permission);
  });

  return [...effective].sort(
    (left, right) =>
      (permissionOrder.get(left) ?? 0) - (permissionOrder.get(right) ?? 0),
  );
};
