import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { shops, users } from "../../db/schema";

export class ShopRepository {
  async findById(shopId: string) {
    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);
    return shop ?? null;
  }

  async findPrimaryAdminByShopId(shopId: string) {
    const [user] = await db
      .select({
        fullName: users.fullName,
        email: users.email,
        mobileNumber: users.mobileNumber,
      })
      .from(users)
      .where(and(eq(users.shopId, shopId), eq(users.role, "admin")))
      .orderBy(asc(users.createdAt), asc(users.id))
      .limit(1);

    return user ?? null;
  }

  async updateProfile(
    shopId: string,
    payload: {
      name: string;
      phone?: string | null | undefined;
      email?: string | null | undefined;
      addressLine1?: string | null | undefined;
      addressLine2?: string | null | undefined;
      city?: string | null | undefined;
      state?: string | null | undefined;
      pincode?: string | null | undefined;
      gstNumber?: string | null | undefined;
      licenseNumber?: string | null | undefined;
      invoicePrefix?: string | null | undefined;
    },
  ) {
    const [shop] = await db
      .update(shops)
      .set({
        name: payload.name,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
        addressLine1: payload.addressLine1 ?? null,
        addressLine2: payload.addressLine2 ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        pincode: payload.pincode ?? null,
        gstNumber: payload.gstNumber ?? null,
        licenseNumber: payload.licenseNumber ?? null,
        invoicePrefix: payload.invoicePrefix ?? "INV",
        updatedAt: new Date(),
      })
      .where(eq(shops.id, shopId))
      .returning();

    return shop ?? null;
  }
}
