import { Injectable, Logger } from "@nestjs/common";

import {
  EmailSender,
  SendEmailInput,
} from "../../modules/application/gateways/email-sender";

@Injectable()
export class LoggingEmailSender extends EmailSender {
  private readonly logger = new Logger(LoggingEmailSender.name);

  async send(input: SendEmailInput): Promise<void> {
    const recipients = Array.isArray(input.to) ? input.to.join(", ") : input.to;

    this.logger.log(
      `Email not sent (RESEND_API_KEY unset): to=${recipients} subject="${input.subject}"`,
    );
  }
}
