import type { UniqueEntityId } from "../../../../shared/entities/unique-entity-id.js";
import type { DomainEvent } from "../../../../shared/events/domain-event.js";
import { Establishment } from "../entities/establishment";

export class EstablishmentRegisteredEvent implements DomainEvent {
  public readonly occurredAt: Date;
  public readonly establishmentId: UniqueEntityId;

  constructor(establishment: Establishment, occurredAt: Date = new Date()) {
    this.occurredAt = occurredAt;
    this.establishmentId = establishment.id;
  }

  getAggregateId(): UniqueEntityId {
    return this.establishmentId;
  }
}
