import { DomainEvents } from "../../../shared/events/domain-events.js";

export abstract class UnitOfWork {
  async execute<T>(work: () => Promise<T>): Promise<T> {
    return DomainEvents.runWithExecutionContext(async (context) => {
      const isRootExecution = context.unitOfWorkDepth === 0;
      context.unitOfWorkDepth += 1;

      try {
        return await this.perform(async () => {
          const result = await work();

          if (isRootExecution) {
            await DomainEvents.dispatchEventsForMarkedAggregates();
          }

          return result;
        });
      } catch (error) {
        if (isRootExecution) {
          DomainEvents.clearMarkedAggregates();
        }

        throw error;
      } finally {
        context.unitOfWorkDepth -= 1;

        if (isRootExecution) {
          context.unitOfWorkDepth = 0;
        }
      }
    });
  }

  protected abstract perform<T>(work: () => Promise<T>): Promise<T>;
}
