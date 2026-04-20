import { apiRequest } from "../../../lib/api";
import type {
  BranchAssignmentSummary,
  BranchFormPayload,
  BranchListResponse,
  BranchRecord,
} from "../../../types/branch";

export const branchesQueryKeys = {
  all: ["branches"] as const,
  list: ["branches", "list"] as const,
  assignments: (userId: string) => ["branches", "assignments", userId] as const,
};

export const getBranches = () =>
  apiRequest<BranchListResponse>({
    method: "GET",
    url: "/branches",
  });

export const createBranch = (payload: BranchFormPayload) =>
  apiRequest<BranchRecord>({
    method: "POST",
    url: "/branches",
    data: payload,
  });

export const updateBranch = (branchId: string, payload: Partial<BranchFormPayload>) =>
  apiRequest<BranchRecord>({
    method: "PATCH",
    url: `/branches/${branchId}`,
    data: payload,
  });

export const getUserBranchAssignments = (userId: string) =>
  apiRequest<BranchAssignmentSummary>({
    method: "GET",
    url: `/branches/users/${userId}/assignments`,
  });

export const updateUserBranchAssignments = (userId: string, branchIds: string[]) =>
  apiRequest<BranchAssignmentSummary>({
    method: "PUT",
    url: `/branches/users/${userId}/assignments`,
    data: { branchIds },
  });
