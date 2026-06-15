export class ServiceCategoryAlreadyDeletedError extends Error {
  constructor() {
    super("Service category is already deleted.");
    this.name = "ServiceCategoryAlreadyDeletedError";
  }
}
