export class CustomerAlreadyDeletedError extends Error {
  constructor() {
    super("Customer is already deleted.");
    this.name = "CustomerAlreadyDeletedError";
  }
}
