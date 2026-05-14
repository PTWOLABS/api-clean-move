export class ServiceAlreadyDeletedError extends Error {
  constructor() {
    super("Service is already deleted.");
    this.name = "ServiceAlreadyDeletedError";
  }
}
