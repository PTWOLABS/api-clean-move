import { Service } from "../../../../modules/catalog/domain/entities/services";
import { ServicePriceSpecification } from "../../../../modules/catalog/domain/value-objects/service-price-specification";
import { ServiceName } from "../../../../modules/catalog/domain/value-objects/service-name";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { PrismaServiceMapper } from "./prisma-service-mapper";

describe("PrismaServiceMapper", () => {
  it("should map a range price specification to prisma", () => {
    const service = Service.create({
      establishmentId: new UniqueEntityId(),
      serviceName: ServiceName.create("Higienizacao interna"),
      priceSpecification: ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      }),
    });

    expect(PrismaServiceMapper.toPrisma(service)).toEqual(
      expect.objectContaining({
        priceInCents: 30000,
        priceSpecificationType: "RANGE",
        priceRangeMaxInCents: 60000,
      }),
    );
  });

  it("should map a prisma service row to a service option", () => {
    expect(
      PrismaServiceMapper.toOption({
        id: "service-id",
        serviceName: "Polimento Premium",
        priceInCents: 30000,
        priceSpecificationType: "RANGE",
        priceRangeMaxInCents: 60000,
      }),
    ).toEqual({
      id: "service-id",
      label: "Polimento Premium",
      priceInCents: 30000,
      priceSpecification: {
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      },
    });
  });
});
