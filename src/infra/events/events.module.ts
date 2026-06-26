import { Module } from "@nestjs/common";

import { CreateAppointmentOnQuoteApproved } from "../../modules/application/subscribers/create-appointment-on-quote-approved";
import { CreateDefaultServiceCategoriesOnEstablishmentRegistered } from "../../modules/application/subscribers/create-default-service-categories-on-establishment-registered";
import { DatabaseModule } from "../database/database.module";

@Module({
  imports: [DatabaseModule],
  providers: [
    CreateAppointmentOnQuoteApproved,
    CreateDefaultServiceCategoriesOnEstablishmentRegistered,
  ],
})
export class EventsModule {}
