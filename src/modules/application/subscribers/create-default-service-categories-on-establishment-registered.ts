import { Injectable, OnModuleDestroy } from "@nestjs/common";

import { DomainEvents } from "../../../shared/events/domain-events";
import { EstablishmentRegisteredEvent } from "../../establishments/domain/events/establishment-registered-event";
import { ServiceCategoriesRepository } from "../repositories/service-categories-repository";
import { createDefaultServiceCategories } from "../services/default-service-categories.factory";

@Injectable()
export class CreateDefaultServiceCategoriesOnEstablishmentRegistered
  implements OnModuleDestroy
{
  constructor(
    private serviceCategoriesRepository: ServiceCategoriesRepository,
  ) {
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    DomainEvents.register(
      this.createDefaultServiceCategories,
      EstablishmentRegisteredEvent.name,
    );
  }

  onModuleDestroy() {
    DomainEvents.unregister(
      this.createDefaultServiceCategories,
      EstablishmentRegisteredEvent.name,
    );
  }

  private createDefaultServiceCategories = async (
    event: EstablishmentRegisteredEvent,
  ) => {
    await this.serviceCategoriesRepository.createMany(
      createDefaultServiceCategories(event.establishmentId),
    );
  };
}
