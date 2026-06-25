export class InvalidOrExpiredPasswordResetTokenError extends Error {
  constructor() {
    super("Invalid or expired password reset token.");
    this.name = "InvalidOrExpiredPasswordResetTokenError";
  }
}
