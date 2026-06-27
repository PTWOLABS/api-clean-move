import type { UniqueEntityId } from "../../../../shared/entities/unique-entity-id.js";
import type { DomainEvent } from "../../../../shared/events/domain-event.js";
import type { User } from "../entities/user";

export class UserRegisteredEvent implements DomainEvent {
  public readonly occurredAt: Date;
  public readonly userId: UniqueEntityId;

  constructor(user: User, occurredAt: Date = new Date()) {
    this.occurredAt = occurredAt;
    this.userId = user.id;
  }

  getAggregateId(): UniqueEntityId {
    return this.userId;
  }
}
