import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";

export function validateQuoteApprovalSchedule(
  startsAt: Date,
  endsAt?: Date | null,
) {
  assertValidDate(startsAt, "startsAt must be a valid date.");

  if (endsAt !== null && endsAt !== undefined) {
    assertValidDate(endsAt, "endsAt must be a valid date.");

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new InvalidQuoteInputError(
        "endsAt must be greater than startsAt.",
        "QUOTE_INVALID_SCHEDULE_INTERVAL",
      );
    }
  }
}

function assertValidDate(value: Date, message: string) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new InvalidQuoteInputError(message);
  }
}
