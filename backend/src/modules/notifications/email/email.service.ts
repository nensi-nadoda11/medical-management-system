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
