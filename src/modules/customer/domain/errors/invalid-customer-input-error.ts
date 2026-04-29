export class InvalidCustomerInputError extends Error {
  constructor(message = "Invalid customer input.") {
    super(message);
    this.name = "InvalidCustomerInputError";
  }
}
