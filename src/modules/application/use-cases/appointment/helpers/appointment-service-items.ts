import { Either, left, right } from "../../../../../shared/either";
import { InvalidAppointmentInputError } from "../../../../scheduling/domain/errors/invalid-appointment-input-error";

export type AppointmentServiceItemInput = {
  serviceId: string;
  priceInCents?: number;
};

export function normalizeAppointmentServiceItems(
  serviceIds?: string[],
  services?: AppointmentServiceItemInput[],
): Either<InvalidAppointmentInputError, AppointmentServiceItemInput[]> {
  if (serviceIds !== undefined && services !== undefined) {
    return left(
      new InvalidAppointmentInputError(
        "Provide either serviceIds or services, not both.",
      ),
    );
  }

  const items =
    services ??
    serviceIds?.map((serviceId) => ({
      serviceId,
    }));

  if (!items || items.length === 0) {
    return left(
      new InvalidAppointmentInputError("At least one service is required."),
    );
  }

  const ids = items.map((item) => item.serviceId);

  if (new Set(ids).size !== ids.length) {
    return left(
      new InvalidAppointmentInputError(
        "Duplicate services are not allowed in the same appointment.",
      ),
    );
  }

  return right(items);
}
