import "reflect-metadata";

import { afterEach } from "vitest";

import { DomainEvents } from "../src/shared/events/domain-events";

type CommonTestHooksOptions = {
  clearHandlers?: boolean;
};

export function registerCommonTestHooks({
  clearHandlers = true,
}: CommonTestHooksOptions = {}): void {
  afterEach(() => {
    if (clearHandlers) {
      DomainEvents.clearHandlers();
    }

    DomainEvents.clearMarkedAggregates();
  });
}
