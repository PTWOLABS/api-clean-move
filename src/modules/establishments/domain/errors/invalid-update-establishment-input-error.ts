export class InvalidUpdateEstablishmentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUpdateEstablishmentInputError";
  }
}
