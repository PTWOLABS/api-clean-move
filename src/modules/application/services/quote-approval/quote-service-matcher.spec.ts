import { EstimatedDuration } from "../../../catalog/domain/value-objects/estimated-duration";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";
import { ServicePriceSpecification } from "../../../catalog/domain/value-objects/service-price-specification";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { QuoteServiceMatcher } from "./quote-service-matcher";

let servicesRepository: InMemoryServicesRepository;
let sut: QuoteServiceMatcher;

describe("Quote service matcher", () => {
  beforeEach(() => {
    servicesRepository = new InMemoryServicesRepository();
    sut = new QuoteServiceMatcher(servicesRepository);
  });

  it("should resolve active linked services and report catalog differences", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const serviceId = new UniqueEntityId("service-1");
    const quoteCategoryId = new UniqueEntityId("category-quote");
    const catalogCategoryId = new UniqueEntityId("category-catalog");
    const catalogService = makeService(
      {
        establishmentId,
        serviceName: ServiceName.create("Nome atual do catalogo"),
        category: { id: catalogCategoryId, name: "Categoria atual" },
        estimatedDuration: EstimatedDuration.create({
          minInMinutes: 20,
          maxInMinutes: 30,
        }),
        priceSpecification: ServicePriceSpecification.create({
          type: "STARTING_AT",
          minPriceInCents: 2222,
        }),
      },
      serviceId,
    );
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId,
          serviceId,
          serviceName: "Nome do snapshot",
          category: { id: quoteCategoryId, name: "Categoria snapshot" },
          durationInMinutes: 60,
          priceInCents: 4000,
          isCourtesy: false,
        },
      ],
    });

    await servicesRepository.create(catalogService);

    const [changedCatalogResult] = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(changedCatalogResult).toMatchObject({
      quoteServiceId: quoteServiceId.toString(),
      status: "RESOLVED",
      requiresResolution: false,
      serviceId: serviceId.toString(),
      candidateServiceId: serviceId.toString(),
      snapshot: {
        name: "Nome do snapshot",
        priceInCents: 4000,
        durationInMinutes: 60,
        categoryId: quoteCategoryId.toString(),
        categoryName: "Categoria snapshot",
        isCourtesy: false,
      },
      candidate: {
        serviceId: serviceId.toString(),
        name: "Nome atual do catalogo",
        isActive: true,
        priceSpecification: {
          type: "STARTING_AT",
          minPriceInCents: 2222,
        },
        durationInMinutes: 30,
        categoryId: catalogCategoryId.toString(),
        categoryName: "Categoria atual",
      },
      allowedActions: [],
    });
    expect(changedCatalogResult?.differences).toEqual(
      expect.arrayContaining([
        "NAME",
        "CATEGORY",
        "DURATION",
        "PRICE_SPECIFICATION",
        "PRICE",
      ]),
    );
  });

  it("should require a decision for linked inactive services", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const inactiveService = makeService({
      establishmentId,
      serviceName: ServiceName.create("Polimento tecnico"),
      isActive: false,
    });
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId,
          serviceId: inactiveService.id,
          serviceName: "Polimento tecnico",
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    await servicesRepository.create(inactiveService);

    const [analysis] = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(analysis).toMatchObject({
      status: "LINKED_SERVICE_INACTIVE",
      requiresResolution: true,
      serviceId: inactiveService.id.toString(),
      candidateServiceId: inactiveService.id.toString(),
      allowedActions: ["KEEP_INACTIVE_LINK", "ASSOCIATE_EXISTING"],
    });
  });

  it("should require recreation or association for linked deleted services", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const deletedService = makeService({ establishmentId });
    deletedService.softDelete(new Date("2026-07-13T10:00:00.000Z"));
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId: new UniqueEntityId("quote-service-1"),
          serviceId: deletedService.id,
          serviceName: "Servico removido",
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    await servicesRepository.create(deletedService);

    const [analysis] = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(analysis).toMatchObject({
      status: "LINKED_SERVICE_DELETED",
      requiresResolution: true,
      serviceId: deletedService.id.toString(),
      candidateServiceId: deletedService.id.toString(),
      allowedActions: ["ASSOCIATE_EXISTING", "RECREATE_FROM_SNAPSHOT"],
    });
  });

  it("should require resolution for missing linked services", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const missingServiceId = new UniqueEntityId("missing-service");
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId: new UniqueEntityId("quote-service-1"),
          serviceId: missingServiceId,
          serviceName: "Servico ausente",
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    const [analysis] = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(analysis).toMatchObject({
      status: "LINKED_SERVICE_MISSING",
      requiresResolution: true,
      serviceId: missingServiceId.toString(),
      candidateServiceId: null,
      candidate: null,
      allowedActions: ["ASSOCIATE_EXISTING", "RECREATE_FROM_SNAPSHOT"],
    });
  });

  it("should require a decision for detached services with an exact name candidate", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const candidate = makeService({
      establishmentId,
      serviceName: ServiceName.create("Higienizacao interna"),
      priceSpecification: ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 4000,
        maxPriceInCents: 8000,
      }),
    });
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId,
          serviceId: null,
          serviceName: "  higienizacao interna  ",
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    await servicesRepository.create(candidate);

    const [analysis] = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(analysis).toMatchObject({
      status: "CANDIDATE_FOUND",
      requiresResolution: true,
      serviceId: null,
      candidateServiceId: candidate.id.toString(),
      allowedActions: ["ASSOCIATE_EXISTING", "RENAME_DETACHED"],
    });
    expect(analysis?.differences).toEqual(
      expect.arrayContaining(["PRICE_SPECIFICATION", "PRICE"]),
    );
  });

  it("should mark detached services without a catalog match as ready to create", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId,
          serviceId: null,
          serviceName: "Vitrificacao premium",
          priceInCents: 10000,
          isCourtesy: true,
        },
      ],
    });

    const [analysis] = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(analysis).toEqual({
      quoteServiceId: quoteServiceId.toString(),
      status: "READY_TO_CREATE",
      requiresResolution: false,
      serviceId: null,
      candidateServiceId: null,
      snapshot: {
        name: "Vitrificacao premium",
        priceInCents: 10000,
        durationInMinutes: null,
        categoryId: null,
        categoryName: null,
        isCourtesy: true,
      },
      candidate: null,
      differences: [],
      allowedActions: [],
    });
  });
});
