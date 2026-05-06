import { randomUUID } from "crypto";
import type { Response } from "express";

export type RealtimeEventType =
  | "connected"
  | "inventory_changed"
  | "purchase_changed"
  | "notification_changed";

export type RealtimeEvent = {
  type: RealtimeEventType;
  shopId: string;
  branchId?: string | null;
  reason: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

type Subscriber = {
  id: string;
  shopId: string;
  response: Response;
};

class RealtimeService {
  private readonly subscribers = new Map<string, Subscriber>();

  subscribe(input: { shopId: string; response: Response }) {
    const subscriber: Subscriber = {
      id: randomUUID(),
      shopId: input.shopId,
      response: input.response,
    };

    this.subscribers.set(subscriber.id, subscriber);

    return () => {
      this.subscribers.delete(subscriber.id);
    };
  }

  sendEvent(
    response: Response,
    event: Omit<RealtimeEvent, "occurredAt"> & { occurredAt?: string },
  ) {
    const payload: RealtimeEvent = {
      ...event,
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    };

    return this.safeWrite(
      response,
      `event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`,
    );
  }

  safeWrite(response: Response, chunk: string) {
    if (response.writableEnded || response.destroyed) {
      return false;
    }

    try {
      response.write(chunk);
      return true;
    } catch {
      return false;
    }
  }

  publish(event: Omit<RealtimeEvent, "occurredAt">) {
    for (const subscriber of this.subscribers.values()) {
      if (subscriber.shopId !== event.shopId) {
        continue;
      }

      try {
        const didWrite = this.sendEvent(subscriber.response, event);

        if (!didWrite) {
          this.subscribers.delete(subscriber.id);
        }
      } catch {
        this.subscribers.delete(subscriber.id);
      }
    }
  }
}

export const realtimeService = new RealtimeService();
