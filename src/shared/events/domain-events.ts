import { AsyncLocalStorage } from "node:async_hooks";
import type { UniqueEntityId } from "../entities/unique-entity-id.js";
import type { DomainEvent } from "./domain-event.js";

export type DomainEventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
) => Promise<void> | void;

type EventCapableAggregate = {
  id: UniqueEntityId;
  clearEvents(): void;
  pullDomainEvents(): DomainEvent[];
};

type DomainEventsExecutionContext = {
  markedAggregates: EventCapableAggregate[];
  unitOfWorkDepth: number;
};

export class DomainEvents {
  private static handlersMap: Record<string, DomainEventHandler[]> = {};
  private static fallbackExecutionContext =
    DomainEvents.createExecutionContext();
  private static executionContextStorage =
    new AsyncLocalStorage<DomainEventsExecutionContext>();

  static register<T extends DomainEvent>(
    callback: DomainEventHandler<T>,
    eventName: string,
  ) {
    const handlers = DomainEvents.handlersMap[eventName] ?? [];
    const handler = callback as DomainEventHandler;

    if (handlers.includes(handler)) {
      return;
    }

    DomainEvents.handlersMap[eventName] = [...handlers, handler];
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
    const context = DomainEvents.getOrCreateExecutionContext();
    const aggregateAlreadyMarked = context.markedAggregates.some((item) =>
      item.id.equals(aggregate.id),
    );

    if (aggregateAlreadyMarked) {
      return;
    }

    context.markedAggregates.push(aggregate);
  }

  static async dispatchEventsForMarkedAggregates(
    context = DomainEvents.getCurrentOrFallbackExecutionContext(),
  ) {
    if (!context) {
      return;
    }

    while (context.markedAggregates.length > 0) {
      const aggregate = context.markedAggregates.shift();

      if (!aggregate) {
        continue;
      }

      const events = aggregate.pullDomainEvents();

      for (const event of events) {
        await DomainEvents.dispatch(event);
      }
    }
  }

  static clearHandlers() {
    DomainEvents.handlersMap = {};
  }

  static clearMarkedAggregates(
    context = DomainEvents.getCurrentOrFallbackExecutionContext(),
  ) {
    if (!context) {
      return;
    }

    while (context.markedAggregates.length > 0) {
      const aggregate = context.markedAggregates.shift();
      aggregate?.clearEvents();
    }
  }

  static runWithExecutionContext<T>(
    work: (context: DomainEventsExecutionContext) => Promise<T>,
  ): Promise<T> {
    const currentContext = DomainEvents.executionContextStorage.getStore();

    if (currentContext) {
      return work(currentContext);
    }

    const context = DomainEvents.createExecutionContext();

    return DomainEvents.executionContextStorage.run(context, () =>
      work(context),
    );
  }

  private static getOrCreateExecutionContext(): DomainEventsExecutionContext {
    const currentContext = DomainEvents.executionContextStorage.getStore();

    if (currentContext) {
      return currentContext;
    }

    return DomainEvents.fallbackExecutionContext;
  }

  private static getCurrentOrFallbackExecutionContext():
    | DomainEventsExecutionContext
    | undefined {
    return (
      DomainEvents.executionContextStorage.getStore() ??
      DomainEvents.fallbackExecutionContext
    );
  }

  private static createExecutionContext(): DomainEventsExecutionContext {
    return {
      markedAggregates: [],
      unitOfWorkDepth: 0,
    };
  }

  private static async dispatch(event: DomainEvent) {
    const handlers = DomainEvents.handlersMap[event.constructor.name] ?? [];

    for (const handler of handlers) {
      await handler(event);
    }
  }
}
