import { env } from "../../../config/env";
import { logger } from "../../../shared/logger";
import { ConsoleEmailProvider } from "./providers/console-email.provider";
import { SmtpEmailProvider } from "./providers/smtp-email.provider";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(input: SendEmailInput): Promise<void>;
}

class EmailService {
  constructor(private readonly provider: EmailProvider) {}

  async send(input: SendEmailInput) {
    await this.provider.send(input);
  }

  async sendRegistrationOtp(input: {
    to: string;
    recipientName: string;
    shopName: string;
    otpCode: string;
    expiresInMinutes: number;
  }) {
    const subject = "Verify your email for Medical Management System";
    const text = [
      `Hello ${input.recipientName},`,
      "",
      `Your email verification code for ${input.shopName} is ${input.otpCode}.`,
      `This code expires in ${input.expiresInMinutes} minutes.`,
      "",
      "If you did not request this, please ignore this email.",
    ].join("\n");

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <p>Hello ${input.recipientName},</p>
        <p>Your email verification code for <strong>${input.shopName}</strong> is:</p>
        <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700;">${input.otpCode}</p>
        <p>This code expires in ${input.expiresInMinutes} minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `;

    await this.provider.send({
      to: input.to,
      subject,
      html,
      text,
    });
  }

  async sendLowStockAlert(input: {
    to: string;
    recipientName: string;
    shopName: string;
    medicineName: string;
    currentAvailableQuantity: number;
    reorderLevel: number;
    batchSummary?: string[];
  }) {
    const subject = `Low stock alert: ${input.medicineName}`;
    const batchLines = input.batchSummary?.length
      ? ["", "Batch summary:", ...input.batchSummary]
      : [];
    const text = [
      `Hello ${input.recipientName},`,
      "",
      `Stock for ${input.medicineName} is low in ${input.shopName}.`,
      `Current stock: ${input.currentAvailableQuantity}`,
      `Reorder level: ${input.reorderLevel}`,
      "Please review and replenish this medicine.",
      ...batchLines,
    ].join("\n");

    const batchHtml = input.batchSummary?.length
      ? `
          <p style="margin: 16px 0 8px;"><strong>Batch summary</strong></p>
          <ul style="margin: 0; padding-left: 18px;">
            ${input.batchSummary.map((line) => `<li>${line}</li>`).join("")}
          </ul>
        `
      : "";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <p>Hello ${input.recipientName},</p>
        <p>
          Stock for <strong>${input.medicineName}</strong> is low in
          <strong>${input.shopName}</strong>.
        </p>
        <p>
          Current stock: <strong>${input.currentAvailableQuantity}</strong><br />
          Reorder level: <strong>${input.reorderLevel}</strong>
        </p>
        <p>Please review and replenish this medicine.</p>
        ${batchHtml}
      </div>
    `;

    await this.provider.send({
      to: input.to,
      subject,
      html,
      text,
    });
  }

  async sendInventoryAttentionAlert(input: {
    to: string;
    recipientName: string;
    shopName: string;
    title: string;
    message: string;
    medicineName: string;
    batchNumber?: string;
    expiryDate?: string;
    quantityAvailable?: number;
    tone: "near_expiry" | "expired";
  }) {
    const subject = `${input.tone === "expired" ? "Expired stock" : "Near expiry"} alert: ${input.medicineName}`;
    const extraLines = [
      input.batchNumber ? `Batch: ${input.batchNumber}` : undefined,
      input.expiryDate ? `Expiry date: ${input.expiryDate.slice(0, 10)}` : undefined,
      input.quantityAvailable !== undefined
        ? `Quantity available: ${input.quantityAvailable}`
        : undefined,
    ].filter(Boolean);

    const text = [
      `Hello ${input.recipientName},`,
      "",
      `${input.title} in ${input.shopName}.`,
      input.message,
      ...extraLines,
      "",
      "Please review the stock position in the system.",
    ].join("\n");

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <p>Hello ${input.recipientName},</p>
        <p><strong>${input.title}</strong> in <strong>${input.shopName}</strong>.</p>
        <p>${input.message}</p>
        ${
          extraLines.length
            ? `<ul style="margin: 0; padding-left: 18px;">${extraLines
                .map((line) => `<li>${line}</li>`)
                .join("")}</ul>`
            : ""
        }
        <p style="margin-top: 16px;">Please review the stock position in the system.</p>
      </div>
    `;

    await this.provider.send({
      to: input.to,
      subject,
      html,
      text,
    });
  }
}

const emailProvider =
  env.EMAIL_PROVIDER === "smtp" || env.EMAIL_PROVIDER === "nodemailer"
    ? new SmtpEmailProvider({
        host: env.SMTP_HOST!,
        port: env.SMTP_PORT!,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER!,
        pass: env.SMTP_PASS!,
        fromAddress: env.EMAIL_FROM_ADDRESS,
        fromName: env.EMAIL_FROM_NAME,
      })
    : new ConsoleEmailProvider();

logger.info("Email provider initialized", { provider: env.EMAIL_PROVIDER });

export const emailService = new EmailService(emailProvider);
