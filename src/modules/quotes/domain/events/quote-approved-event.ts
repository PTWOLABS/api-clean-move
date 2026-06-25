import type { UniqueEntityId } from "../../../../shared/entities/unique-entity-id.js";
import type { DomainEvent } from "../../../../shared/events/domain-event.js";
import type { Quote } from "../entities/quote";

type QuoteApprovedSchedule = {
  startsAt: Date;
  endsAt: Date | null;
};

export class QuoteApprovedEvent implements DomainEvent {
  public readonly occurredAt: Date;
  public readonly quoteId: UniqueEntityId;
  public readonly establishmentId: UniqueEntityId;
  public readonly startsAt: Date;
  public readonly endsAt: Date | null;

  constructor(
    quote: Quote,
    schedule: QuoteApprovedSchedule,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
    this.quoteId = quote.id;
    this.establishmentId = quote.establishmentId;
    this.startsAt = schedule.startsAt;
    this.endsAt = schedule.endsAt;
  }

  getAggregateId(): UniqueEntityId {
    return this.quoteId;
  }
}
