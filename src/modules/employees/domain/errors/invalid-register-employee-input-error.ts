export class InvalidRegisterEmployeeInputError extends Error {
  constructor(message = "Invalid employee registration input.") {
    super(message);
    this.name = "InvalidRegisterEmployeeInputError";
  }
}
