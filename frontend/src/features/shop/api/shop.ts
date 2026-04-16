import { apiRequest } from "../../../lib/api";
import type { ShopProfile, UpdateShopProfilePayload } from "../../../types/shop";

export const shopQueryKeys = {
  profile: ["shop", "profile"] as const,
};

export const getShopProfile = () =>
  apiRequest<ShopProfile>({
    method: "GET",
    url: "/shop/profile",
  });

export const updateShopProfile = (payload: UpdateShopProfilePayload) =>
  apiRequest<ShopProfile>({
    method: "PATCH",
    url: "/shop/profile",
    data: payload,
  });
