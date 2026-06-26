import {
  EmailSender,
  SendEmailInput,
} from "../../src/modules/application/gateways/email-sender";

export class FakeEmailSender extends EmailSender {
  public readonly sent: SendEmailInput[] = [];

  async send(input: SendEmailInput): Promise<void> {
    this.sent.push(input);
  }
}
