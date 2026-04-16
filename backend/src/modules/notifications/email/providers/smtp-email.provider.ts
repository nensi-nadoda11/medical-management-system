import nodemailer from "nodemailer";

import type { EmailProvider, SendEmailInput } from "../email.service";

interface SmtpEmailProviderOptions {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromAddress: string;
  fromName: string;
}

export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(options: SmtpEmailProviderOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: {
        user: options.user,
        pass: options.pass,
      },
    });
    this.fromAddress = options.fromAddress;
    this.fromName = options.fromName;
  }

  async send(input: SendEmailInput) {
    await this.transporter.sendMail({
      from: `"${this.fromName}" <${this.fromAddress}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  }
}
