import { PersistenceError } from "./persistence-error";

export type UniqueConstraintResource =
  | "CUSTOMER_DOCUMENT"
  | "VEHICLE_PLATE"
  | "SERVICE_NAME"
  | "UNKNOWN";

export class UniqueConstraintViolationError extends PersistenceError {
  constructor(public readonly resource: UniqueConstraintResource = "UNKNOWN") {
    super("A unique constraint was violated.");
    this.name = "UniqueConstraintViolationError";
  }
}
