import { env } from "../../../config/env";
import { logger } from "../../../shared/logger";
import { ConsoleSmsProvider } from "./providers/console-sms.provider";
import { TwilioSmsProvider } from "./providers/twilio-sms.provider";

export interface SendSmsInput {
  to: string;
  body: string;
}

export interface SmsProvider {
  send(input: SendSmsInput): Promise<void>;
}

class SmsService {
  constructor(private readonly provider: SmsProvider) {}

  async sendRegistrationOtp(input: {
    to: string;
    otpCode: string;
    expiresInMinutes: number;
  }) {
    await this.provider.send({
      to: input.to,
      body: `Your Medical Management System verification code is ${input.otpCode}. It expires in ${input.expiresInMinutes} minutes.`,
    });
  }
}

const smsProvider =
  env.SMS_PROVIDER === "twilio"
    ? new TwilioSmsProvider({
        accountSid: env.TWILIO_ACCOUNT_SID!,
        authToken: env.TWILIO_AUTH_TOKEN!,
        fromNumber: env.TWILIO_FROM_NUMBER!,
      })
    : new ConsoleSmsProvider();

logger.info("SMS provider initialized", { provider: env.SMS_PROVIDER });

export const smsService = new SmsService(smsProvider);
