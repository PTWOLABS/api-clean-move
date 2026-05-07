export class EmployeeAlreadyDeletedError extends Error {
  constructor(message = "Employee already deleted.") {
    super(message);
    this.name = "EmployeeAlreadyDeletedError";
  }
}
