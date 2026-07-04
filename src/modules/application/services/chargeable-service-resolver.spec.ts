import { UniqueEntityId } from "../../../shared/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { makeService } from "../../../../tests/factories/service-factory";
import { InMemoryServicesRepository } from "../../../../tests/repositories/in-memory-services-repository";
import { InactiveServiceError } from "../../catalog/domain/errors/inactive-service-error";
import { ServicePriceSpecification } from "../../catalog/domain/value-objects/service-price-specification";
import { resolveChargeableServices } from "./chargeable-service-resolver";

class InvalidTestServicePriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTestServicePriceError";
  }
}

describe("resolveChargeableServices", () => {
  let servicesRepository: InMemoryServicesRepository;
  let establishmentId: UniqueEntityId;

  const makeInvalidPriceError = (message: string) =>
    new InvalidTestServicePriceError(message);

  beforeEach(() => {
    servicesRepository = new InMemoryServicesRepository();
    establishmentId = new UniqueEntityId();
  });

  it("should resolve active services with their default charge prices", async () => {
    const fixedService = makeService({ establishmentId });
    const rangeService = makeService({
      establishmentId,
      priceSpecification: ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      }),
    });

    await servicesRepository.create(fixedService);
    await servicesRepository.create(rangeService);

    const result = await resolveChargeableServices({
      servicesRepository,
      establishmentId: establishmentId.toString(),
      serviceItems: [
        { serviceId: fixedService.id.toString() },
        { serviceId: rangeService.id.toString() },
      ],
      makeInvalidPriceError,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value).toEqual([
        {
          service: fixedService,
          priceInCents:
            fixedService.priceSpecification.defaultChargePriceInCents,
        },
        {
          service: rangeService,
          priceInCents: 30000,
        },
      ]);
    }
  });

  it("should resolve active services with explicit valid charged prices", async () => {
    const service = makeService({
      establishmentId,
      priceSpecification: ServicePriceSpecification.create({
        type: "STARTING_AT",
        minPriceInCents: 25000,
      }),
    });

    await servicesRepository.create(service);

    const result = await resolveChargeableServices({
      servicesRepository,
      establishmentId: establishmentId.toString(),
      serviceItems: [
        {
          serviceId: service.id.toString(),
          priceInCents: 35000,
        },
      ],
      makeInvalidPriceError,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value).toEqual([
        {
          service,
          priceInCents: 35000,
        },
      ]);
    }
  });

  it("should reject missing services", async () => {
    const result = await resolveChargeableServices({
      servicesRepository,
      establishmentId: establishmentId.toString(),
      serviceItems: [{ serviceId: new UniqueEntityId().toString() }],
      makeInvalidPriceError,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject soft-deleted services", async () => {
    const service = makeService({ establishmentId });
    service.softDelete(new Date("2026-07-03T12:00:00.000Z"));

    await servicesRepository.create(service);

    const result = await resolveChargeableServices({
      servicesRepository,
      establishmentId: establishmentId.toString(),
      serviceItems: [{ serviceId: service.id.toString() }],
      makeInvalidPriceError,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject inactive services", async () => {
    const service = makeService({
      establishmentId,
      isActive: false,
    });

    await servicesRepository.create(service);

    const result = await resolveChargeableServices({
      servicesRepository,
      establishmentId: establishmentId.toString(),
      serviceItems: [{ serviceId: service.id.toString() }],
      makeInvalidPriceError,
    });

    expect(result.isLeft()).toBe(true);
    if (result.isRight()) throw new Error("Expected inactive service error.");
    expect(result.value).toBeInstanceOf(InactiveServiceError);
    expect(result.value.message).toContain(service.serviceName.value);
  });

  it("should reject charged prices outside the service price policy", async () => {
    const service = makeService({
      establishmentId,
      priceSpecification: ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      }),
    });

    await servicesRepository.create(service);

    const result = await resolveChargeableServices({
      servicesRepository,
      establishmentId: establishmentId.toString(),
      serviceItems: [
        {
          serviceId: service.id.toString(),
          priceInCents: 60001,
        },
      ],
      makeInvalidPriceError,
    });

    expect(result.isLeft()).toBe(true);
    if (result.isRight()) throw new Error("Expected invalid price error.");
    expect(result.value).toBeInstanceOf(InvalidTestServicePriceError);
    expect(result.value.message).toBe(
      "charged price must be within service price range.",
    );
  });
});
