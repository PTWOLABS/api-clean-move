export class DoneAppointmentCannotBeDeletedError extends Error {
  constructor() {
    super("Done appointments cannot be deleted.");
    this.name = "DoneAppointmentCannotBeDeletedError";
  }
}
