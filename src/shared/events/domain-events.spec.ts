import { afterEach, describe, expect, it, vi } from "vitest";

import { UnitOfWork } from "../../modules/application/repositories/unit-of-work";
import { AggregateRoot } from "../entities/aggregate-root";
import { UniqueEntityId } from "../entities/unique-entity-id";
import type { DomainEvent } from "./domain-event";
import { DomainEvents } from "./domain-events";

class TestDomainEvent implements DomainEvent {
  public readonly occurredAt = new Date();

  constructor(
    private readonly aggregateId: UniqueEntityId,
    public readonly name: string,
  ) {}

  getAggregateId(): UniqueEntityId {
    return this.aggregateId;
  }
}

class TestAggregate extends AggregateRoot<Record<string, never>> {
  static create(id?: UniqueEntityId) {
    return new TestAggregate({}, id);
  }

  record(name: string) {
    this.addDomainEvent(new TestDomainEvent(this.id, name));
  }
}

class TestUnitOfWork extends UnitOfWork {
  protected async perform<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("DomainEvents", () => {
  afterEach(() => {
    DomainEvents.clearHandlers();
    DomainEvents.clearMarkedAggregates();
  });

  it("should dispatch marked aggregate events and remove them from the aggregate", async () => {
    const aggregate = TestAggregate.create();
    const handledEvents: TestDomainEvent[] = [];

    DomainEvents.register<TestDomainEvent>((event) => {
      handledEvents.push(event);
    }, TestDomainEvent.name);

    aggregate.record("registered");

    await DomainEvents.dispatchEventsForMarkedAggregates();

    expect(handledEvents.map((event) => event.name)).toEqual(["registered"]);
    expect(aggregate.domainEvents).toHaveLength(0);
  });

  it("should dispatch all events from an aggregate marked more than once only once per event", async () => {
    const aggregate = TestAggregate.create();
    const handledEvents: TestDomainEvent[] = [];

    DomainEvents.register<TestDomainEvent>((event) => {
      handledEvents.push(event);
    }, TestDomainEvent.name);

    aggregate.record("first");
    aggregate.record("second");

    await DomainEvents.dispatchEventsForMarkedAggregates();

    expect(handledEvents.map((event) => event.name)).toEqual([
      "first",
      "second",
    ]);
    expect(aggregate.domainEvents).toHaveLength(0);
  });

  it("should clear pending events and skip dispatch when UnitOfWork work fails", async () => {
    const unitOfWork = new TestUnitOfWork();
    const aggregate = TestAggregate.create();
    const handler = vi.fn();

    DomainEvents.register<TestDomainEvent>(handler, TestDomainEvent.name);

    await expect(
      unitOfWork.execute(async () => {
        aggregate.record("before-failure");

        throw new Error("Failed before dispatch.");
      }),
    ).rejects.toThrow("Failed before dispatch.");

    expect(handler).not.toHaveBeenCalled();
    expect(aggregate.domainEvents).toHaveLength(0);

    await DomainEvents.dispatchEventsForMarkedAggregates();

    expect(handler).not.toHaveBeenCalled();
  });

  it("should propagate handler failures and not call later handlers for the same event", async () => {
    const unitOfWork = new TestUnitOfWork();
    const aggregate = TestAggregate.create();
    const firstHandler = vi.fn(() => {
      throw new Error("Critical handler failed.");
    });
    const secondHandler = vi.fn();

    DomainEvents.register<TestDomainEvent>(firstHandler, TestDomainEvent.name);
    DomainEvents.register<TestDomainEvent>(secondHandler, TestDomainEvent.name);

    await expect(
      unitOfWork.execute(async () => {
        aggregate.record("critical");
      }),
    ).rejects.toThrow("Critical handler failed.");

    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).not.toHaveBeenCalled();
  });

  it("should not register the same handler more than once for an event", async () => {
    const aggregate = TestAggregate.create();
    const handler = vi.fn();

    DomainEvents.register<TestDomainEvent>(handler, TestDomainEvent.name);
    DomainEvents.register<TestDomainEvent>(handler, TestDomainEvent.name);

    aggregate.record("registered");

    await DomainEvents.dispatchEventsForMarkedAggregates();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should clear aggregate events when there are no handlers registered", async () => {
    const unitOfWork = new TestUnitOfWork();
    const aggregate = TestAggregate.create();

    await expect(
      unitOfWork.execute(async () => {
        aggregate.record("unhandled");
      }),
    ).resolves.toBeUndefined();

    expect(aggregate.domainEvents).toHaveLength(0);
  });

  it("should not dispatch events from another active UnitOfWork execution", async () => {
    const unitOfWork = new TestUnitOfWork();
    const firstAggregate = TestAggregate.create();
    const secondAggregate = TestAggregate.create();
    const firstWorkStarted = createDeferred();
    const releaseFirstWork = createDeferred();
    const handledEvents: string[] = [];

    DomainEvents.register<TestDomainEvent>((event) => {
      handledEvents.push(event.name);
    }, TestDomainEvent.name);

    const firstExecution = unitOfWork.execute(async () => {
      firstAggregate.record("first");
      firstWorkStarted.resolve();
      await releaseFirstWork.promise;
    });

    await firstWorkStarted.promise;

    await unitOfWork.execute(async () => {
      secondAggregate.record("second");
    });

    const handledAfterSecondExecution = [...handledEvents];

    releaseFirstWork.resolve();
    await firstExecution;

    expect(handledAfterSecondExecution).toEqual(["second"]);
    expect(handledEvents).toEqual(["second", "first"]);
    expect(firstAggregate.domainEvents).toHaveLength(0);
    expect(secondAggregate.domainEvents).toHaveLength(0);
  });

  it("should dispatch events only after the outermost UnitOfWork finishes", async () => {
    const unitOfWork = new TestUnitOfWork();
    const outerAggregate = TestAggregate.create();
    const innerAggregate = TestAggregate.create();
    const handledEvents: string[] = [];
    let handledEventsAfterInnerExecution: string[] = [];

    DomainEvents.register<TestDomainEvent>((event) => {
      handledEvents.push(event.name);
    }, TestDomainEvent.name);

    await unitOfWork.execute(async () => {
      outerAggregate.record("outer");

      await unitOfWork.execute(async () => {
        innerAggregate.record("inner");
      });

      handledEventsAfterInnerExecution = [...handledEvents];
    });

    expect(handledEventsAfterInnerExecution).toEqual([]);
    expect(handledEvents).toEqual(["outer", "inner"]);
  });

  it("should not clear events from another active UnitOfWork when a handler fails", async () => {
    const unitOfWork = new TestUnitOfWork();
    const firstAggregate = TestAggregate.create();
    const secondAggregate = TestAggregate.create();
    const firstWorkStarted = createDeferred();
    const releaseFirstWork = createDeferred();
    const handledEvents: string[] = [];

    DomainEvents.register<TestDomainEvent>((event) => {
      if (event.name === "second") {
        throw new Error("Failed to handle second event.");
      }

      handledEvents.push(event.name);
    }, TestDomainEvent.name);

    const firstExecution = unitOfWork.execute(async () => {
      firstAggregate.record("first");
      firstWorkStarted.resolve();
      await releaseFirstWork.promise;
    });

    await firstWorkStarted.promise;

    await expect(
      unitOfWork.execute(async () => {
        secondAggregate.record("second");
      }),
    ).rejects.toThrow("Failed to handle second event.");

    const firstEventsAfterSecondFailure = firstAggregate.domainEvents;

    releaseFirstWork.resolve();
    await firstExecution;

    expect(firstEventsAfterSecondFailure).toHaveLength(1);
    expect(handledEvents).toEqual(["first"]);
  });
});
