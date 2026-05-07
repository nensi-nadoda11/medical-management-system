import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";

import { realtimeService } from "../src/modules/realtime/realtime.service";

const createResponseMock = () =>
  ({
    writableEnded: false,
    destroyed: false,
    write: vi.fn(),
  }) as unknown as Response;

describe("realtime branch scoping", () => {
  it("delivers branch-specific events only to matching branch subscribers", () => {
    const branchAResponse = createResponseMock();
    const branchBResponse = createResponseMock();

    const unsubscribeA = realtimeService.subscribe({
      shopId: "shop-1",
      branchId: "branch-a",
      response: branchAResponse,
    });
    const unsubscribeB = realtimeService.subscribe({
      shopId: "shop-1",
      branchId: "branch-b",
      response: branchBResponse,
    });

    realtimeService.publish({
      type: "inventory_changed",
      shopId: "shop-1",
      branchId: "branch-a",
      reason: "test-event",
      metadata: {
        branchId: "branch-a",
      },
    });

    expect(branchAResponse.write).toHaveBeenCalledOnce();
    expect(branchBResponse.write).not.toHaveBeenCalled();

    unsubscribeA();
    unsubscribeB();
  });

  it("still delivers shop-wide events to every subscriber in the shop", () => {
    const branchAResponse = createResponseMock();
    const branchBResponse = createResponseMock();

    const unsubscribeA = realtimeService.subscribe({
      shopId: "shop-1",
      branchId: "branch-a",
      response: branchAResponse,
    });
    const unsubscribeB = realtimeService.subscribe({
      shopId: "shop-1",
      branchId: "branch-b",
      response: branchBResponse,
    });

    realtimeService.publish({
      type: "notification_changed",
      shopId: "shop-1",
      branchId: null,
      reason: "shop-wide-event",
    });

    expect(branchAResponse.write).toHaveBeenCalledOnce();
    expect(branchBResponse.write).toHaveBeenCalledOnce();

    unsubscribeA();
    unsubscribeB();
  });
});
