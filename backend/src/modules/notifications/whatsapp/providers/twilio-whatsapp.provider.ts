import twilio from "twilio";

import type {
  SendWhatsappInput,
  WhatsappProvider,
} from "../whatsapp.service";

interface TwilioWhatsappProviderOptions {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

const toWhatsappAddress = (value: string) =>
  value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;

export class TwilioWhatsappProvider implements WhatsappProvider {
  private readonly client;
  private readonly fromNumber: string;

  constructor(options: TwilioWhatsappProviderOptions) {
    this.client = twilio(options.accountSid, options.authToken);
    this.fromNumber = toWhatsappAddress(options.fromNumber);
  }

  async send(input: SendWhatsappInput) {
    const payload: {
      from: string;
      to: string;
      body?: string;
      contentSid?: string;
      contentVariables?: string;
    } = {
      from: toWhatsappAddress(input.from ?? this.fromNumber),
      to: toWhatsappAddress(input.to),
    };

    if (input.contentSid) {
      payload.contentSid = input.contentSid;

      if (input.contentVariables && Object.keys(input.contentVariables).length) {
        payload.contentVariables = JSON.stringify(input.contentVariables);
      }
    } else if (input.body) {
      payload.body = input.body;
    } else {
      throw new Error(
        "WhatsApp message payload must include either a body or a contentSid.",
      );
    }

    await this.client.messages.create(payload);
  }
}
