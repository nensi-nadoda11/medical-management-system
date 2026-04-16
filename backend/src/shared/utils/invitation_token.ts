import crypto from "node:crypto";

export const generateInvitationToken = () =>
  crypto.randomBytes(32).toString("hex");

export const hashInvitationToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");
