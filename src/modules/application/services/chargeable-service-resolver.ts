import { Either, left, right } from "../../../shared/either";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { Service } from "../../catalog/domain/entities/services";
import { InactiveServiceError } from "../../catalog/domain/errors/inactive-service-error";
import { ServicesRepository } from "../repositories/services-repository";

export type ChargeableServiceItemInput = {
  serviceId: string;
  priceInCents?: number | undefined;
};

export type ResolvedChargeableService = {
  service: Service;
  priceInCents: number;
};

type ResolveChargeableServicesParams<TInvalidPriceError extends Error> = {
  servicesRepository: ServicesRepository;
  establishmentId: string;
  serviceItems: ChargeableServiceItemInput[];
  makeInvalidPriceError: (message: string) => TInvalidPriceError;
};

export async function resolveChargeableServices<
  TInvalidPriceError extends Error,
>({
  servicesRepository,
  establishmentId,
  serviceItems,
  makeInvalidPriceError,
}: ResolveChargeableServicesParams<TInvalidPriceError>): Promise<
  Either<
    ResourceNotFoundError | InactiveServiceError | TInvalidPriceError,
    ResolvedChargeableService[]
  >
> {
  const resolvedServices: ResolvedChargeableService[] = [];

  for (const item of serviceItems) {
    const service = await servicesRepository.findByServiceIdAndEstablishmentId(
      item.serviceId,
      establishmentId,
    );

    if (!service || service.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "service" }));
    }

    if (!service.isActive) {
      return left(new InactiveServiceError(service.serviceName.value));
    }

    const priceInCents =
      item.priceInCents ?? service.priceSpecification.defaultChargePriceInCents;

    try {
      service.priceSpecification.assertCanCharge(priceInCents);
    } catch (error) {
      return left(
        makeInvalidPriceError(
          error instanceof Error ? error.message : "Invalid service price.",
        ),
      );
    }

    resolvedServices.push({
      service,
      priceInCents,
    });
  }

  return right(resolvedServices);
}
