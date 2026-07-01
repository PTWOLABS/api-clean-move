import { Injectable, OnModuleDestroy } from "@nestjs/common";

import { EnvService } from "../../../infra/env/env.service";
import { UserPasswordChangedEvent } from "../../accounts/domain/events/user-password-changed-event";
import { DomainEvents } from "../../../shared/events/domain-events";
import { EmailSender } from "../gateways/email-sender";
import { buildPasswordChangedEmail } from "../mail/templates/password-changed-email";
import { UsersRepository } from "../repositories/users-repository";

@Injectable()
export class SendPasswordChangedEmailOnUserPasswordChanged implements OnModuleDestroy {
  constructor(
    private usersRepository: UsersRepository,
    private emailSender: EmailSender,
    private envService: EnvService,
  ) {
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    DomainEvents.register(
      this.sendPasswordChangedEmail,
      UserPasswordChangedEvent.name,
    );
  }

  onModuleDestroy() {
    DomainEvents.unregister(
      this.sendPasswordChangedEmail,
      UserPasswordChangedEvent.name,
    );
  }

  private sendPasswordChangedEmail = async (
    event: UserPasswordChangedEvent,
  ) => {
    const user = await this.usersRepository.findById(event.userId.toString());

    if (!user) {
      return;
    }

    const emailContent = buildPasswordChangedEmail({
      loginUrl: new URL(
        "/login",
        this.envService.get("FRONTEND_URL"),
      ).toString(),
      logoUrl: this.envService.get("EMAIL_LOGO_URL"),
    });

    await this.emailSender.send({
      to: user.email.getValue(),
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  };
}
