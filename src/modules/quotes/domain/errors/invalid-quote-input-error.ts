export class InvalidQuoteInputError extends Error {
  constructor(message = "Invalid quote input.") {
    super(message);
    this.name = "InvalidQuoteInputError";
  }
}
