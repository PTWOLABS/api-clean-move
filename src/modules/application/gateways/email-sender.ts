export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export abstract class EmailSender {
  abstract send(input: SendEmailInput): Promise<void>;
}
