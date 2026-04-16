import { createHmac, randomInt, timingSafeEqual } from "crypto";

import { env } from "../../config/env";

export const generateNumericOtp = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

export const hashOtpCode = (input: {
  otpId: string;
  code: string;
  channel: string;
  purpose: string;
  target: string;
}) =>
  createHmac("sha256", env.OTP_HASH_SECRET)
    .update(`${input.otpId}.${input.purpose}.${input.channel}.${input.target}.${input.code}`)
    .digest("hex");

export const verifyOtpCodeHash = (input: {
  otpId: string;
  code: string;
  channel: string;
  purpose: string;
  target: string;
  hashedCode: string;
}) => {
  const candidate = hashOtpCode(input);
  const expectedBuffer = Buffer.from(input.hashedCode, "hex");
  const candidateBuffer = Buffer.from(candidate, "hex");

  return (
    expectedBuffer.length === candidateBuffer.length &&
    timingSafeEqual(expectedBuffer, candidateBuffer)
  );
};
