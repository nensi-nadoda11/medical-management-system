import { AppError } from "../../shared/errors/app-error";
import { ShopRepository } from "./shop.repository";
import type { UpdateShopProfileInput } from "./shop.validation";

const buildAppError = (statusCode: number, code: string, message: string) =>
  new AppError({
    statusCode,
    code,
    message,
  });

export class ShopService {
  constructor(private readonly shopRepository = new ShopRepository()) {}

  async getProfile(shopId: string) {
    const shop = await this.shopRepository.findById(shopId);

    if (!shop) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    return shop;
  }

  async updateProfile(shopId: string, input: UpdateShopProfileInput) {
    const existingShop = await this.shopRepository.findById(shopId);

    if (!existingShop) {
      throw buildAppError(404, "SHOP_NOT_FOUND", "Shop not found.");
    }

    const payload = input;

    const updatedShop = await this.shopRepository.updateProfile(shopId, payload);

    if (!updatedShop) {
      throw buildAppError(
        500,
        "SHOP_UPDATE_FAILED",
        "Failed to update shop profile.",
      );
    }

    return updatedShop;
  }
}
