export class InvalidCurrentPasswordError extends Error {
  constructor(message = "Current password is incorrect.") {
    super(message);
    this.name = "InvalidCurrentPasswordError";
  }
}
