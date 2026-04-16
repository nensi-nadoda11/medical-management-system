import { z } from "zod";

export const inviteUserSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(320),
  role: z.enum(["staff", "accountant"]),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(160).optional(),
  role: z.enum(["staff", "accountant"]).optional(),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const acceptInvitationSchema = z
  .object({
    token: z.string().trim().min(10),
    password: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
      .regex(/[a-z]/, "Password must include at least one lowercase letter.")
      .regex(/[0-9]/, "Password must include at least one number.")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must include at least one special character.",
      ),
    confirmPassword: z.string().min(8).max(128),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
