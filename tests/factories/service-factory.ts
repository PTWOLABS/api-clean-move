import {
  Service,
  ServiceProps,
} from "../../src/modules/catalog/domain/entities/services";
import { UniqueEntityId } from "../../src/shared/entities/unique-entity-id";
import { EstimatedDuration } from "../../src/modules/catalog/domain/value-objects/estimated-duration";
import { Money } from "../../src/modules/catalog/domain/value-objects/money";
import { ServiceName } from "../../src/modules/catalog/domain/value-objects/service-name";
import { ServicePriceSpecification } from "../../src/modules/catalog/domain/value-objects/service-price-specification";
import { makeProductDescription, makeProductName } from "./random-data";
import { PrismaService } from "../../src/infra/database/prisma/prisma.service";
import { PrismaServiceMapper } from "../../src/infra/database/prisma/mappers/prisma-service-mapper";
import { makeServiceCategoryRef } from "../helpers/service-category-ref";

type MakeServiceOverride = Partial<ServiceProps> & {
  price?: Money;
};

export function makeService(
  override?: MakeServiceOverride,
  id?: UniqueEntityId,
) {
  const { price, ...serviceOverride } = override ?? {};

  const service = Service.create(
    {
      establishmentId: new UniqueEntityId(),
      serviceName: ServiceName.create(makeProductName()),
      description: makeProductDescription(),
      category: makeServiceCategoryRef(),
      estimatedDuration: EstimatedDuration.create({
        minInMinutes: 30,
        maxInMinutes: 60,
      }),
      priceSpecification:
        price !== undefined
          ? ServicePriceSpecification.create({
              type: "FIXED",
              fixedPriceInCents: price.amountInCents,
            })
          : ServicePriceSpecification.create({
              type: "FIXED",
              fixedPriceInCents: 30000,
            }),
      ...serviceOverride,
    },
    id,
  );

  return service;
}

export class ServiceFactory {
  constructor(private prisma: PrismaService) {}

  async makePrismaService(
    override?: Partial<ServiceProps>,
    id?: UniqueEntityId,
  ) {
    const service = makeService(
      {
        category: undefined,
        ...override,
      },
      id,
    );

    if (service.category) {
      const categoryExists = await this.prisma.serviceCategory.findUnique({
        where: { id: service.category.id.toString() },
      });

      if (!categoryExists) {
        await this.prisma.serviceCategory.create({
          data: {
            id: service.category.id.toString(),
            establishmentId: service.establishmentId.toString(),
            name: service.category.name,
          },
        });
      }
    }

    await this.prisma.service.create({
      data: PrismaServiceMapper.toPrisma(service),
    });

    return service;
  }
}
