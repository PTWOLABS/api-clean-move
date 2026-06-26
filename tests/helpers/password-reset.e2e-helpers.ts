import {
  EmailSender,
  SendEmailInput,
} from "../../src/modules/application/gateways/email-sender";

export class CapturingEmailSender extends EmailSender {
  public readonly sent: SendEmailInput[] = [];

  async send(input: SendEmailInput): Promise<void> {
    this.sent.push(input);
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export function extractPasswordResetTokenFromEmail(html: string): string {
  const match = /[?&]token=([^"&]+)/.exec(html);

  if (!match?.[1]) {
    throw new Error("Expected password reset token in email HTML.");
  }

  return decodeURIComponent(match[1]);
}
