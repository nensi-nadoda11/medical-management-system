import type {
  SendWhatsappInput,
  WhatsappProvider,
} from "../whatsapp.service";

import { logger } from "../../../../shared/logger";

export class ConsoleWhatsappProvider implements WhatsappProvider {
  async send(input: SendWhatsappInput) {
    logger.info("WhatsApp alert dispatched through console provider", {
      to: input.to,
      from: input.from,
      body: input.body,
      contentSid: input.contentSid,
      contentVariables: input.contentVariables,
    });
  }
}
