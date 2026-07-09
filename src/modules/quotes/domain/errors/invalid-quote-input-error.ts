export type QuoteErrorCode =
  | "INVALID_QUOTE_INPUT"
  | "QUOTE_ALREADY_CONVERTED"
  | "QUOTE_ALREADY_HAS_CUSTOMER"
  | "QUOTE_CANNOT_BE_APPROVED_FOR_PROSPECT"
  | "QUOTE_INVALID_SCHEDULE_INTERVAL"
  | "QUOTE_VEHICLE_SNAPSHOT_MISSING"
  | "QUOTE_VEHICLE_SNAPSHOT_INCOMPLETE"
  | "QUOTE_CUSTOMER_ADDRESS_INCOMPLETE";

export class InvalidQuoteInputError extends Error {
  constructor(
    message = "Invalid quote input.",
    public readonly code: QuoteErrorCode = "INVALID_QUOTE_INPUT",
  ) {
    super(message);
    this.name = "InvalidQuoteInputError";
  }
}
