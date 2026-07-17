import type { UniqueEntityId } from "../../../../shared/entities/unique-entity-id.js";
import type { DomainEvent } from "../../../../shared/events/domain-event.js";
import type { Quote } from "../entities/quote";

export class QuoteConvertedEvent implements DomainEvent {
  public readonly quoteId: UniqueEntityId;
  public readonly establishmentId: UniqueEntityId;

  constructor(
    quote: Quote,
    public readonly appointmentId: UniqueEntityId,
    public readonly occurredAt: Date = new Date(),
  ) {
    this.quoteId = quote.id;
    this.establishmentId = quote.establishmentId;
  }

  getAggregateId(): UniqueEntityId {
    return this.quoteId;
  }
}
