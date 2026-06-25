export class EmailDeliveryError extends Error {
  constructor(message = "Failed to deliver email.") {
    super(message);
    this.name = "EmailDeliveryError";
  }
}
