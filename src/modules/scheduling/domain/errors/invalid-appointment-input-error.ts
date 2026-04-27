export class InvalidAppointmentInputError extends Error {
  constructor(message = "Invalid appointment input.") {
    super(message);
    this.name = "InvalidAppointmentInputError";
  }
}
