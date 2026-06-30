export class SamePasswordError extends Error {
  readonly code = "SAME_AS_CURRENT_PASSWORD";
  readonly field = "newPassword";

  constructor(
    message = "The new password must be different from your current password.",
  ) {
    super(message);
    this.name = "SamePasswordError";
  }
}
