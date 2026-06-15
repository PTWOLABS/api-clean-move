export class OAuthEmailMismatchError extends Error {
  constructor(message = "OAuth email does not match the account email.") {
    super(message);
    this.name = "OAuthEmailMismatchError";
  }
}
