export class AppointmentAlreadyDeletedError extends Error {
  constructor() {
    super("Appointment is already deleted.");
    this.name = "AppointmentAlreadyDeletedError";
  }
}
