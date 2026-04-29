import { env } from "../../../config/env";
import { logger } from "../../../shared/logger";
import { ConsoleWhatsappProvider } from "./providers/console-whatsapp.provider";
import { TwilioWhatsappProvider } from "./providers/twilio-whatsapp.provider";

export interface SendWhatsappInput {
  to: string;
  body?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
  from?: string;
}

export interface WhatsappProvider {
  send(input: SendWhatsappInput): Promise<void>;
}

class WhatsappService {
  constructor(private readonly provider: WhatsappProvider) {}

  async send(input: SendWhatsappInput) {
    await this.provider.send(input);
  }

  private resolveFromNumber(shopId?: string) {
    if (!shopId) {
      return undefined;
    }

    return env.whatsappShopSenderMap[shopId];
  }

  private hasTemplateSid(value?: string): value is string {
    return Boolean(value && /^HX[a-zA-Z0-9]{32}$/.test(value));
  }

  private toTemplateVariables(
    variables: Record<string, string | number | undefined>,
  ) {
    return Object.fromEntries(
      Object.entries(variables).map(([key, value]) => [
        key,
        value === undefined ? "-" : String(value),
      ]),
    );
  }

  private async sendTemplateOrBody(input: {
    to: string;
    shopId?: string;
    body: string;
    templateSid?: string;
    templateVariables?: Record<string, string | number | undefined>;
  }) {
    const from = this.resolveFromNumber(input.shopId);

    if (this.hasTemplateSid(input.templateSid)) {
      await this.provider.send({
        to: input.to,
        ...(from ? { from } : {}),
        contentSid: input.templateSid,
        contentVariables: this.toTemplateVariables(input.templateVariables ?? {}),
      });
      return;
    }

    await this.provider.send({
      to: input.to,
      ...(from ? { from } : {}),
      body: input.body,
    });
  }

  async sendLowStockAlert(input: {
    to: string;
    shopId?: string;
    shopName: string;
    medicineName: string;
    currentAvailableQuantity: number;
    reorderLevel: number;
  }) {
    const body = [
      `${input.shopName}: low stock alert`,
      `${input.medicineName} stock is ${input.currentAvailableQuantity}.`,
      `Reorder level: ${input.reorderLevel}.`,
      "Please review and refill soon.",
    ].join(" ");

    await this.sendTemplateOrBody({
      to: input.to,
      ...(input.shopId ? { shopId: input.shopId } : {}),
      body,
      ...(env.TWILIO_WHATSAPP_ADMIN_LOW_STOCK_TEMPLATE_SID
        ? {
            templateSid:
              env.TWILIO_WHATSAPP_ADMIN_LOW_STOCK_TEMPLATE_SID,
          }
        : {}),
      templateVariables: {
        1: input.shopName,
        2: input.medicineName,
        3: input.currentAvailableQuantity,
        4: input.reorderLevel,
      },
    });
  }

  async sendInventoryAttentionAlert(input: {
    to: string;
    shopId?: string;
    shopName: string;
    title: string;
    message: string;
    batchNumber?: string;
    expiryDate?: string;
    quantityAvailable?: number;
  }) {
    const extraLines = [
      input.batchNumber ? `Batch: ${input.batchNumber}.` : undefined,
      input.expiryDate ? `Expiry: ${input.expiryDate.slice(0, 10)}.` : undefined,
      input.quantityAvailable !== undefined
        ? `Available: ${input.quantityAvailable}.`
        : undefined,
    ].filter(Boolean);

    const body = [
      `${input.shopName}: ${input.title}.`,
      input.message,
      ...extraLines,
      "Please review in the system.",
    ].join(" ");

    await this.sendTemplateOrBody({
      to: input.to,
      ...(input.shopId ? { shopId: input.shopId } : {}),
      body,
      ...(env.TWILIO_WHATSAPP_INVENTORY_ATTENTION_TEMPLATE_SID
        ? {
            templateSid:
              env.TWILIO_WHATSAPP_INVENTORY_ATTENTION_TEMPLATE_SID,
          }
        : {}),
      templateVariables: {
        1: input.shopName,
        2: input.title,
        3: input.message,
        4: input.batchNumber,
        5: input.expiryDate ? input.expiryDate.slice(0, 10) : undefined,
        6: input.quantityAvailable,
      },
    });
  }

  async sendSupplierReorderAlert(input: {
    to: string;
    shopId?: string;
    shopName: string;
    supplierName: string;
    medicineName: string;
    currentAvailableQuantity: number;
    reorderLevel: number;
  }) {
    const shortage = Math.max(
      input.reorderLevel - input.currentAvailableQuantity,
      0,
    );

    const body = [
      `${input.shopName}: reorder request.`,
      `${input.medicineName} stock is ${input.currentAvailableQuantity}.`,
      `Reorder level: ${input.reorderLevel}.`,
      `Gap: ${shortage}.`,
      `Please confirm supply for ${input.supplierName}.`,
    ].join(" ");

    await this.sendTemplateOrBody({
      to: input.to,
      ...(input.shopId ? { shopId: input.shopId } : {}),
      body,
      ...(env.TWILIO_WHATSAPP_SUPPLIER_REORDER_TEMPLATE_SID
        ? {
            templateSid:
              env.TWILIO_WHATSAPP_SUPPLIER_REORDER_TEMPLATE_SID,
          }
        : {}),
      templateVariables: {
        1: input.shopName,
        2: input.supplierName,
        3: input.medicineName,
        4: input.currentAvailableQuantity,
        5: input.reorderLevel,
        6: shortage,
      },
    });
  }
}

const whatsappProvider =
  env.WHATSAPP_PROVIDER === "twilio"
    ? new TwilioWhatsappProvider({
        accountSid: env.TWILIO_ACCOUNT_SID!,
        authToken: env.TWILIO_AUTH_TOKEN!,
        fromNumber: env.TWILIO_WHATSAPP_FROM_NUMBER!,
      })
    : new ConsoleWhatsappProvider();

logger.info("WhatsApp provider initialized", { provider: env.WHATSAPP_PROVIDER });

if (env.WHATSAPP_PROVIDER === "twilio") {
  logger.info("WhatsApp production configuration loaded", {
    lowStockTemplateConfigured: /^HX[a-zA-Z0-9]{32}$/.test(
      env.TWILIO_WHATSAPP_ADMIN_LOW_STOCK_TEMPLATE_SID ?? "",
    ),
    inventoryAttentionTemplateConfigured: /^HX[a-zA-Z0-9]{32}$/.test(
      env.TWILIO_WHATSAPP_INVENTORY_ATTENTION_TEMPLATE_SID ?? "",
    ),
    supplierReorderTemplateConfigured: /^HX[a-zA-Z0-9]{32}$/.test(
      env.TWILIO_WHATSAPP_SUPPLIER_REORDER_TEMPLATE_SID ?? "",
    ),
    shopSenderOverrides: Object.keys(env.whatsappShopSenderMap).length,
  });
}

export const whatsappService = new WhatsappService(whatsappProvider);
