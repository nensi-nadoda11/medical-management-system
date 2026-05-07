import { describe, expect, it, vi } from "vitest";

import { AppError } from "../src/shared/errors/app-error";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import {
  canDeletePurchaseForPermissions,
  requiresFinalizeAccessForDeletion,
} from "../src/modules/purchases/purchases.service";

const createUser = (permissions: string[]) => ({
  id: "user-1",
  shopId: "shop-1",
  role: "staff" as const,
  fullName: "Test User",
  email: "test@example.com",
  mobileNumber: "9999999999",
  isActive: true,
  emailVerified: true,
  mobileVerified: true,
  permissions,
});

describe("NotificationsService branch scoping", () => {
  it("passes the active branch scope into list and count queries", async () => {
    const listNotifications = vi.fn(async () => []);
    const countNotifications = vi.fn(async () => 0);
    const service = new NotificationsService({
      listNotifications,
      countNotifications,
    } as never);

    await service.listNotifications("shop-1", "branch-1", createUser(["inventory.view"]), {
      page: 1,
      pageSize: 10,
      activeOnly: true,
    });

    expect(listNotifications).toHaveBeenCalledWith(
      "shop-1",
      expect.objectContaining({
        branchId: "branch-1",
      }),
    );
    expect(countNotifications).toHaveBeenCalledWith(
      "shop-1",
      expect.objectContaining({
        branchId: "branch-1",
      }),
    );
  });

  it("blocks mark-as-read for notifications outside the active branch scope", async () => {
    const markAsRead = vi.fn();
    const service = new NotificationsService({
      findById: vi.fn(async () => ({
        id: "notification-1",
        shopId: "shop-1",
        branchId: "branch-2",
        type: "low_stock",
      })),
      markAsRead,
    } as never);

    await expect(
      service.markAsRead(
        "shop-1",
        "branch-1",
        createUser(["inventory.view"]),
        "notification-1",
      ),
    ).rejects.toMatchObject<AppError>({
      statusCode: 404,
      code: "NOTIFICATION_NOT_FOUND",
    });

    expect(markAsRead).not.toHaveBeenCalled();
  });
});

describe("purchase delete permission helpers", () => {
  it("allows plain draft deletion with create access", () => {
    expect(
      canDeletePurchaseForPermissions(
        {
          status: "draft",
          purchaseOrderApprovedAt: null,
          supplierNotifiedAt: null,
        },
        ["purchases.create"],
      ),
    ).toBe(true);
    expect(
      requiresFinalizeAccessForDeletion({
        status: "draft",
        purchaseOrderApprovedAt: null,
        supplierNotifiedAt: null,
      }),
    ).toBe(false);
  });

  it("requires finalize access once the purchase is beyond plain draft", () => {
    const approvedDraft = {
      status: "draft" as const,
      purchaseOrderApprovedAt: new Date(),
      supplierNotifiedAt: null,
    };

    expect(
      canDeletePurchaseForPermissions(approvedDraft, ["purchases.create"]),
    ).toBe(false);
    expect(
      canDeletePurchaseForPermissions(approvedDraft, ["purchases.finalize"]),
    ).toBe(true);
    expect(requiresFinalizeAccessForDeletion(approvedDraft)).toBe(true);
  });
});
