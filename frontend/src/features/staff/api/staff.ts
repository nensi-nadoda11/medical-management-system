import { apiRequest } from "../../../lib/api";
import type {
  InviteUserPayload,
  StaffUser,
  UpdateUserPayload,
  UpdateUserStatusPayload,
  UserInvitation,
} from "../../../types/staff";

export const staffQueryKeys = {
  users: ["staff", "users"] as const,
  invitations: ["staff", "invitations"] as const,
};

export const getUsers = () =>
  apiRequest<StaffUser[]>({
    method: "GET",
    url: "/users",
  });

export const getInvitations = () =>
  apiRequest<UserInvitation[]>({
    method: "GET",
    url: "/users/invitations/list",
  });

export const inviteUser = (payload: InviteUserPayload) =>
  apiRequest<UserInvitation>({
    method: "POST",
    url: "/users/invitations",
    data: payload,
  });

export const updateUser = (userId: string, payload: UpdateUserPayload) =>
  apiRequest<StaffUser>({
    method: "PATCH",
    url: `/users/${userId}`,
    data: payload,
  });

export const updateUserStatus = (userId: string, payload: UpdateUserStatusPayload) =>
  apiRequest<StaffUser>({
    method: "PATCH",
    url: `/users/${userId}/status`,
    data: payload,
  });

export const resendInvitation = (invitationId: string) =>
  apiRequest<UserInvitation>({
    method: "POST",
    url: `/users/invitations/${invitationId}/resend`,
  });

export const revokeInvitation = (invitationId: string) =>
  apiRequest<UserInvitation>({
    method: "POST",
    url: `/users/invitations/${invitationId}/revoke`,
  });
