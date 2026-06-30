export class InvalidUserPasswordUpdateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUserPasswordUpdateInputError";
  }
}
