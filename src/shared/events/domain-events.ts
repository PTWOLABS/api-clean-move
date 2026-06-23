import type { UniqueEntityId } from "../entities/unique-entity-id.js";
import type { DomainEvent } from "./domain-event.js";

export type DomainEventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
) => Promise<void> | void;

type EventCapableAggregate = {
  id: UniqueEntityId;
  domainEvents: DomainEvent[];
  clearEvents(): void;
};

export class DomainEvents {
  private static handlersMap: Record<string, DomainEventHandler[]> = {};
  private static markedAggregates: EventCapableAggregate[] = [];

  static register<T extends DomainEvent>(
    callback: DomainEventHandler<T>,
    eventName: string,
  ) {
    const handlers = DomainEvents.handlersMap[eventName] ?? [];

    DomainEvents.handlersMap[eventName] = [
      ...handlers,
      callback as DomainEventHandler,
    ];
  }

  static unregister<T extends DomainEvent>(
    callback: DomainEventHandler<T>,
    eventName: string,
  ) {
    const handlers = DomainEvents.handlersMap[eventName] ?? [];

    DomainEvents.handlersMap[eventName] = handlers.filter(
      (handler) => handler !== callback,
    );
  }

  static markAggregateForDispatch(aggregate: EventCapableAggregate) {
    const aggregateAlreadyMarked = DomainEvents.markedAggregates.some((item) =>
      item.id.equals(aggregate.id),
    );

    if (aggregateAlreadyMarked) {
      return;
    }

    DomainEvents.markedAggregates.push(aggregate);
  }

  static async dispatchEventsForMarkedAggregates() {
    while (DomainEvents.markedAggregates.length > 0) {
      const aggregate = DomainEvents.markedAggregates.shift();

      if (!aggregate) {
        continue;
      }

      const events = [...aggregate.domainEvents];
      aggregate.clearEvents();

      for (const event of events) {
        await DomainEvents.dispatch(event);
      }
    }
  }

  static clearHandlers() {
    DomainEvents.handlersMap = {};
  }

  static clearMarkedAggregates() {
    while (DomainEvents.markedAggregates.length > 0) {
      const aggregate = DomainEvents.markedAggregates.shift();
      aggregate?.clearEvents();
    }
  }

  private static async dispatch(event: DomainEvent) {
    const handlers = DomainEvents.handlersMap[event.constructor.name] ?? [];

    for (const handler of handlers) {
      await handler(event);
    }
  }
}
