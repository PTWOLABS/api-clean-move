import { Injectable, OnModuleDestroy } from "@nestjs/common";

import { EnvService } from "../../../infra/env/env.service";
import { UserRegisteredEvent } from "../../accounts/domain/events/user-registered-event";
import { UserRole } from "../../accounts/domain/value-objects/user-role";
import { DomainEvents } from "../../../shared/events/domain-events";
import { EmailSender } from "../gateways/email-sender";
import { buildWelcomeEmail } from "../mail/templates/welcome-email";
import { UsersRepository } from "../repositories/users-repository";

const WELCOME_EMAIL_ROLES = new Set<UserRole>(["CUSTOMER", "ESTABLISHMENT"]);

@Injectable()
export class SendWelcomeEmailOnUserRegistered implements OnModuleDestroy {
  constructor(
    private usersRepository: UsersRepository,
    private emailSender: EmailSender,
    private envService: EnvService,
  ) {
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    DomainEvents.register(this.sendWelcomeEmail, UserRegisteredEvent.name);
  }

  onModuleDestroy() {
    DomainEvents.unregister(this.sendWelcomeEmail, UserRegisteredEvent.name);
  }

  private sendWelcomeEmail = async (event: UserRegisteredEvent) => {
    const user = await this.usersRepository.findById(event.userId.toString());

    if (!user) {
      return;
    }

    if (!WELCOME_EMAIL_ROLES.has(user.role)) {
      return;
    }

    const emailContent = buildWelcomeEmail({
      userName: user.name,
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
