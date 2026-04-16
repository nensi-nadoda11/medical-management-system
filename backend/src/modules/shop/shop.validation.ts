import { z } from "zod";

export const updateShopProfileSchema = z.object({
  name: z.string().trim().min(3).max(160),
  phone: z.string().trim().min(8).max(20).optional().nullable(),
  email: z.string().trim().email().max(320).optional().nullable(),
  addressLine1: z.string().trim().max(255).optional().nullable(),
  addressLine2: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  pincode: z.string().trim().max(20).optional().nullable(),
  gstNumber: z.string().trim().max(50).optional().nullable(),
  licenseNumber: z.string().trim().max(100).optional().nullable(),
  invoicePrefix: z.string().trim().min(2).max(20).optional().nullable(),
});

export type UpdateShopProfileInput = z.infer<typeof updateShopProfileSchema>;
