export interface BranchSettingsInput {
  lowStockThreshold?: number;
  lowStockAlertsEnabled?: boolean;
  lowStockEmailAlertsEnabled?: boolean;
  nearExpiryAlertDays?: number;
  expiryAlertsEnabled?: boolean;
  expiryEmailAlertsEnabled?: boolean;
  invoicePrefix?: string;
}

export interface BranchRecord {
  id: string;
  shopId: string;
  name: string;
  code: string;
  address: string | null;
  contactNumber: string | null;
  status: "active" | "inactive";
  isDefault: boolean;
  assignedUsers: number;
  settings: {
    lowStockThreshold: number | null;
    lowStockAlertsEnabled: boolean | null;
    lowStockEmailAlertsEnabled: boolean | null;
    nearExpiryAlertDays: number | null;
    expiryAlertsEnabled: boolean | null;
    expiryEmailAlertsEnabled: boolean | null;
    invoicePrefix: string | null;
  };
}

export interface BranchListResponse {
  selectedBranchId: string;
  defaultBranchId: string;
  items: BranchRecord[];
}

export interface BranchFormPayload {
  name: string;
  code: string;
  address?: string;
  contactNumber?: string;
  status: "active" | "inactive";
  isDefault: boolean;
  settings: BranchSettingsInput;
}

export interface BranchAssignmentSummary {
  branchIds: string[];
  items: Array<{
    id: string;
    name: string;
    code: string;
    isDefault: boolean;
    status: "active" | "inactive";
  }>;
}
