import { Module } from "@nestjs/common";

import { EmailSender } from "../../modules/application/gateways/email-sender";
import { EnvModule } from "../env/env.module";
import { EnvService } from "../env/env.service";
import { LoggingEmailSender } from "./logging-email-sender.service";
import { ResendEmailSender } from "./resend-email-sender.service";

/**
 * Future domain-event subscribers should inject EmailSender, build a template,
 * and call send(). For async delivery, introduce EmailDispatcher + BullMQ and
 * keep ResendEmailSender as the worker implementation.
 */
@Module({
  imports: [EnvModule],
  providers: [
    {
      provide: EmailSender,
      useFactory: (envService: EnvService) => {
        const apiKey = envService.get("RESEND_API_KEY");

        if (apiKey) {
          return new ResendEmailSender(envService);
        }

        return new LoggingEmailSender();
      },
      inject: [EnvService],
    },
  ],
  exports: [EmailSender],
})
export class MailModule {}
