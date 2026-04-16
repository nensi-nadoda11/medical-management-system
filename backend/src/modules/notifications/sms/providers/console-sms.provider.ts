import type { SendSmsInput, SmsProvider } from "../sms.service";

import { logger } from "../../../../shared/logger";

export class ConsoleSmsProvider implements SmsProvider {
  async send(input: SendSmsInput) {
    logger.info("SMS OTP dispatched through console provider", {
      to: input.to,
      body: input.body,
    });
  }
}
