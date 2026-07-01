export class InvalidCurrentPasswordError extends Error {
  readonly code = "INVALID_CURRENT_PASSWORD";
  readonly field = "currentPassword";

  constructor(
    message = "The current password you entered is incorrect. Check the password and try again.",
  ) {
    super(message);
    this.name = "InvalidCurrentPasswordError";
  }
}
