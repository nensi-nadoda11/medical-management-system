import twilio from "twilio";

import type { SendSmsInput, SmsProvider } from "../sms.service";

interface TwilioSmsProviderOptions {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioSmsProvider implements SmsProvider {
  private readonly client;
  private readonly fromNumber: string;

  constructor(options: TwilioSmsProviderOptions) {
    this.client = twilio(options.accountSid, options.authToken);
    this.fromNumber = options.fromNumber;
  }

  async send(input: SendSmsInput) {
    await this.client.messages.create({
      from: this.fromNumber,
      to: input.to,
      body: input.body,
    });
  }
}
