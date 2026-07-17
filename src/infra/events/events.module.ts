import { Module } from "@nestjs/common";

import { CreateDefaultServiceCategoriesOnEstablishmentRegistered } from "../../modules/application/subscribers/create-default-service-categories-on-establishment-registered";
import { RevokeSessionsOnUserPasswordChanged } from "../../modules/application/subscribers/revoke-sessions-on-user-password-changed";
import { SendPasswordChangedEmailOnUserPasswordChanged } from "../../modules/application/subscribers/send-password-changed-email-on-user-password-changed";
import { SendWelcomeEmailOnUserRegistered } from "../../modules/application/subscribers/send-welcome-email-on-user-registered";
import { DatabaseModule } from "../database/database.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [DatabaseModule, MailModule],
  providers: [
    CreateDefaultServiceCategoriesOnEstablishmentRegistered,
    RevokeSessionsOnUserPasswordChanged,
    SendPasswordChangedEmailOnUserPasswordChanged,
    SendWelcomeEmailOnUserRegistered,
  ],
})
export class EventsModule {}
