import { Injectable } from "@nestjs/common";
import { Resend } from "resend";

import {
  EmailSender,
  SendEmailInput,
} from "../../modules/application/gateways/email-sender";
import { EmailDeliveryError } from "../../shared/errors/email-delivery-error";
import { EnvService } from "../env/env.service";

@Injectable()
export class ResendEmailSender extends EmailSender {
  private readonly client: Resend;

  constructor(private readonly envService: EnvService) {
    super();
    this.client = new Resend(this.envService.get("RESEND_API_KEY"));
  }

  async send(input: SendEmailInput): Promise<void> {
    const from = this.envService.get("RESEND_FROM_EMAIL");

    if (!from) {
      throw new EmailDeliveryError("RESEND_FROM_EMAIL is not configured.");
    }

    const { data, error } = await this.client.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text !== undefined ? { text: input.text } : {}),
      ...(input.replyTo !== undefined ? { replyTo: input.replyTo } : {}),
    });

    if (error) {
      throw new EmailDeliveryError(error.message);
    }

    if (!data) {
      throw new EmailDeliveryError();
    }
  }
}
