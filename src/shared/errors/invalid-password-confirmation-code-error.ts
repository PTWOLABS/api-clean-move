export class InvalidPasswordConfirmationCodeError extends Error {
  readonly code = "INVALID_PASSWORD_CONFIRMATION_CODE";
  readonly field = "confirmationCode";

  constructor(
    message = "The confirmation code is invalid or has expired. Request a new code and try again.",
  ) {
    super(message);
    this.name = "InvalidPasswordConfirmationCodeError";
  }
}
