import { apiRequest } from "../../../lib/api";
import type { InvitationPreview } from "../../../types/staff";

export interface AcceptInvitationPayload {
  token: string;
  password: string;
  confirmPassword: string;
}

export const invitationQueryKeys = {
  preview: (token: string) => ["invitation", "preview", token] as const,
};

export const getInvitationPreview = (token: string) =>
  apiRequest<InvitationPreview>({
    method: "GET",
    url: `/users/invitation/accept/${token}`,
  });

export const acceptInvitation = (payload: AcceptInvitationPayload) =>
  apiRequest<{
    id: string;
    email: string;
    role: string;
  }>({
    method: "POST",
    url: "/users/invitation/accept",
    data: payload,
  });
