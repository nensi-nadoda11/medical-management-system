export type StaffRole = "staff" | "accountant";

export interface StaffUser {
  id: string;
  shopId: string;
  role: "admin" | StaffRole;
  fullName: string;
  email: string;
  mobileNumber: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserInvitation {
  id: string;
  shopId: string;
  email: string;
  fullName: string;
  role: "admin" | StaffRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  lastSentAt: string;
  invitedByUserId: string;
  createdUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvitationPreview {
  fullName: string;
  email: string;
  role: "admin" | StaffRole;
  expiresAt: string;
}

export interface InviteUserPayload {
  fullName: string;
  email: string;
  role: StaffRole;
}

export interface UpdateUserPayload {
  fullName?: string;
  role?: StaffRole;
}

export interface UpdateUserStatusPayload {
  isActive: boolean;
}

export const getInvitationStatus = (invitation: UserInvitation) => {
  if (invitation.acceptedAt) {
    return "accepted" as const;
  }

  if (invitation.revokedAt) {
    return "revoked" as const;
  }

  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    return "expired" as const;
  }

  return "pending" as const;
};
