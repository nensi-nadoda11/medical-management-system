import type { EmailProvider, SendEmailInput } from "../email.service";

import { logger } from "../../../../shared/logger";

export class ConsoleEmailProvider implements EmailProvider {
  async send(input: SendEmailInput) {
    logger.info("Email OTP dispatched through console provider", {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  }

  async verify() {
    logger.info("Console email provider ready");
  }
}
