import type { NextFunction, Request, Response } from "express";
import { ShopService } from "./shop.service";
import { updateShopProfileSchema } from "./shop.validation";

export class ShopController {
  constructor(private readonly shopService = new ShopService()) {}

  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = (req.authenticatedUser ?? req.authSession!.user).shopId;
      const shop = await this.shopService.getProfile(shopId);

      return res.status(200).json({ data: shop });
    } catch (error) {
      return next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = req.authenticatedUser!.shopId;
      const payload = updateShopProfileSchema.parse(req.body);
      const shop = await this.shopService.updateProfile(shopId, payload);

      return res.status(200).json({
        message: "Shop profile updated successfully.",
        data: shop,
      });
    } catch (error) {
      return next(error);
    }
  };
}
