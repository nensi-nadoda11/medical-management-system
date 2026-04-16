import { z } from "zod";

import { normalizePhoneNumber } from "../../shared/utils/phone";
import { collapseWhitespace, normalizeEmail } from "../../shared/utils/strings";
import { OTP_CHANNELS } from "./auth.types";

const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter a valid 6-digit OTP.");

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters long.")
  .max(72, "Password must be 72 characters or fewer.")
  .regex(/[a-z]/, "Password must include at least one lowercase letter.")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
  .regex(/\d/, "Password must include at least one number.")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must include at least one special character.",
  );

const mobileNumberSchema = z
  .string()
  .trim()
  .min(1, "Mobile number is required.")
  .transform((value, ctx) => {
    const normalized = normalizePhoneNumber(value);

    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid mobile number.",
      });
      return z.NEVER;
    }

    return normalized;
  });

export const registerAdminSchema = z.object({
  body: z
    .object({
      shopName: z
        .string()
        .trim()
        .min(2, "Shop name is required.")
        .max(160, "Shop name must be 160 characters or fewer.")
        .transform(collapseWhitespace),
      fullName: z
        .string()
        .trim()
        .min(2, "Full name is required.")
        .max(160, "Full name must be 160 characters or fewer.")
        .transform(collapseWhitespace),
      email: z
        .string()
        .trim()
        .min(1, "Email is required.")
        .email("Enter a valid email address.")
        .transform(normalizeEmail),
      mobileNumber: mobileNumberSchema,
      password: passwordSchema,
      confirmPassword: z.string().min(1, "Please confirm your password."),
      termsAccepted: z
        .boolean()
        .refine(
          (value) => value === true,
          "You must accept the terms and conditions.",
        ),
    })
    .superRefine((value, ctx) => {
      if (value.password !== value.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirmPassword"],
          message: "Password confirmation does not match.",
        });
      }
    }),
});

export const verifyRegistrationSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Enter a valid email address.")
      .transform(normalizeEmail),
    mobileNumber: mobileNumberSchema,
    otp: otpCodeSchema,
  }),
});

export const resendRegistrationOtpSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Enter a valid email address.")
      .transform(normalizeEmail),
    mobileNumber: mobileNumberSchema,
    channels: z.array(z.enum(OTP_CHANNELS)).nonempty().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Enter a valid email address.")
      .transform(normalizeEmail),
    password: z.string().min(1, "Password is required."),
  }),
});

export type RegisterAdminInput = z.infer<typeof registerAdminSchema>["body"];
export type VerifyRegistrationInput = z.infer<
  typeof verifyRegistrationSchema
>["body"];
export type ResendRegistrationOtpInput = z.infer<
  typeof resendRegistrationOtpSchema
>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
