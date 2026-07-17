import { EstimatedDuration } from "../../../catalog/domain/value-objects/estimated-duration";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";
import { ServicePriceSpecification } from "../../../catalog/domain/value-objects/service-price-specification";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import {
  QuoteApprovalAnalysis,
  QuoteServiceAnalysisItem,
} from "./quote-approval-analysis";
import {
  QuoteApprovalResolutionRequiredError,
  QuoteInvalidResolutionActionError,
} from "./quote-approval-resolution-error";
import { QuoteServiceResolver } from "./quote-service-resolver";

let servicesRepository: InMemoryServicesRepository;
let sut: QuoteServiceResolver;

describe("Quote service resolver", () => {
  beforeEach(() => {
    servicesRepository = new InMemoryServicesRepository();
    sut = new QuoteServiceResolver(servicesRepository);
  });

  it("should associate an existing service without changing commercial snapshot fields", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const catalogService = makeService({
      establishmentId,
      serviceName: ServiceName.create("Polimento catalogo"),
      priceSpecification: ServicePriceSpecification.create({
        type: "FIXED",
        fixedPriceInCents: 6000,
      }),
    });
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId,
          serviceId: null,
          serviceName: "Polimento snapshot",
          durationInMinutes: 45,
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    await servicesRepository.create(catalogService);

    await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis([
        serviceAnalysis({
          quoteServiceId: quoteServiceId.toString(),
          status: "CANDIDATE_FOUND",
          requiresResolution: true,
          allowedActions: ["ASSOCIATE_EXISTING", "RENAME_DETACHED"],
        }),
      ]),
      resolutions: [
        {
          quoteServiceId: quoteServiceId.toString(),
          action: "ASSOCIATE_EXISTING",
          serviceId: catalogService.id.toString(),
        },
      ],
    });

    expect(quote.services[0]?.serviceId).toEqual(catalogService.id);
    expect(quote.services[0]?.serviceName).toBe("Polimento snapshot");
    expect(quote.services[0]?.durationInMinutes).toBe(45);
    expect(quote.services[0]?.priceInCents).toBe(5000);
    expect(catalogService.priceSpecification.defaultChargePriceInCents).toBe(
      6000,
    );
  });

  it("should rename a detached service and materialize it at the unchanged snapshot price", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId,
          serviceId: null,
          serviceName: "Polimento antigo",
          category: { id: new UniqueEntityId("category-1"), name: "Estetica" },
          durationInMinutes: 60,
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis([
        serviceAnalysis({
          quoteServiceId: quoteServiceId.toString(),
          status: "CANDIDATE_FOUND",
          requiresResolution: true,
          allowedActions: ["RENAME_DETACHED", "RECREATE_FROM_SNAPSHOT"],
        }),
      ]),
      resolutions: [
        {
          quoteServiceId: quoteServiceId.toString(),
          action: "RENAME_DETACHED",
          serviceName: "Polimento novo",
        },
      ],
    });

    const createdService = servicesRepository.items[0];

    expect(createdService?.serviceName.value).toBe("Polimento novo");
    expect(createdService?.priceSpecification.toValue()).toEqual({
      type: "FIXED",
      fixedPriceInCents: 5000,
    });
    expect(createdService?.category?.name).toBe("Estetica");
    expect(createdService?.estimatedDuration?.upperBoundInMinutes).toBe(60);
    expect(quote.services[0]?.serviceName).toBe("Polimento novo");
    expect(quote.services[0]?.serviceId).toEqual(createdService?.id);
    expect(quote.services[0]?.priceInCents).toBe(5000);
  });

  it("should reject rename when the new detached name is unavailable", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const existingService = makeService({
      establishmentId,
      serviceName: ServiceName.create("Nome existente"),
    });
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId,
          serviceId: null,
          serviceName: "Nome antigo",
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    await servicesRepository.create(existingService);

    await expect(
      sut.resolve({
        quote,
        establishmentId,
        analysis: analysis([
          serviceAnalysis({
            quoteServiceId: quoteServiceId.toString(),
            status: "CANDIDATE_FOUND",
            requiresResolution: true,
            allowedActions: ["RENAME_DETACHED"],
          }),
        ]),
        resolutions: [
          {
            quoteServiceId: quoteServiceId.toString(),
            action: "RENAME_DETACHED",
            serviceName: "Nome existente",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(QuoteInvalidResolutionActionError);
  });

  it("should keep an inactive linked service", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const inactiveService = makeService({
      establishmentId,
      isActive: false,
    });
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId,
          serviceId: inactiveService.id,
          serviceName: "Servico snapshot",
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    await servicesRepository.create(inactiveService);

    await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis([
        serviceAnalysis({
          quoteServiceId: quoteServiceId.toString(),
          status: "LINKED_SERVICE_INACTIVE",
          requiresResolution: true,
          serviceId: inactiveService.id.toString(),
          candidateServiceId: inactiveService.id.toString(),
          allowedActions: ["KEEP_INACTIVE_LINK", "ASSOCIATE_EXISTING"],
        }),
      ]),
      resolutions: [
        {
          quoteServiceId: quoteServiceId.toString(),
          action: "KEEP_INACTIVE_LINK",
        },
      ],
    });

    expect(quote.services[0]?.serviceId).toEqual(inactiveService.id);
    expect(servicesRepository.items).toHaveLength(1);
  });

  it("should recreate a linked deleted service from the snapshot", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const deletedServiceId = new UniqueEntityId("deleted-service");
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId,
          serviceId: deletedServiceId,
          serviceName: "Servico snapshot",
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis([
        serviceAnalysis({
          quoteServiceId: quoteServiceId.toString(),
          status: "LINKED_SERVICE_DELETED",
          requiresResolution: true,
          serviceId: deletedServiceId.toString(),
          allowedActions: ["RECREATE_FROM_SNAPSHOT"],
        }),
      ]),
      resolutions: [
        {
          quoteServiceId: quoteServiceId.toString(),
          action: "RECREATE_FROM_SNAPSHOT",
        },
      ],
    });

    expect(servicesRepository.items).toHaveLength(1);
    expect(quote.services[0]?.serviceId).toEqual(
      servicesRepository.items[0]?.id,
    );
    expect(quote.services[0]?.serviceName).toBe("Servico snapshot");
    expect(quote.services[0]?.priceInCents).toBe(5000);
  });

  it("should materialize ready-to-create detached services without a decision", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId,
          serviceId: null,
          serviceName: "Servico novo",
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis([
        serviceAnalysis({
          quoteServiceId: quoteServiceId.toString(),
          status: "READY_TO_CREATE",
          requiresResolution: false,
          allowedActions: [],
        }),
      ]),
      resolutions: [],
    });

    expect(servicesRepository.items[0]?.serviceName.value).toBe("Servico novo");
    expect(quote.services[0]?.serviceId).toEqual(
      servicesRepository.items[0]?.id,
    );
  });

  it("should reject duplicate, missing, and inapplicable decisions", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId,
          serviceId: null,
          serviceName: "Servico novo",
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });
    const quoteAnalysis = analysis([
      serviceAnalysis({
        quoteServiceId: quoteServiceId.toString(),
        status: "CANDIDATE_FOUND",
        requiresResolution: true,
        allowedActions: ["RENAME_DETACHED"],
      }),
    ]);

    await expect(
      sut.resolve({
        quote,
        establishmentId,
        analysis: quoteAnalysis,
        resolutions: [],
      }),
    ).rejects.toBeInstanceOf(QuoteApprovalResolutionRequiredError);

    await expect(
      sut.resolve({
        quote,
        establishmentId,
        analysis: quoteAnalysis,
        resolutions: [
          {
            quoteServiceId: quoteServiceId.toString(),
            action: "RENAME_DETACHED",
            serviceName: "A",
          },
          {
            quoteServiceId: quoteServiceId.toString(),
            action: "RENAME_DETACHED",
            serviceName: "B",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(QuoteInvalidResolutionActionError);

    await expect(
      sut.resolve({
        quote,
        establishmentId,
        analysis: quoteAnalysis,
        resolutions: [
          {
            quoteServiceId: quoteServiceId.toString(),
            action: "ASSOCIATE_EXISTING",
            serviceId: "service-1",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(QuoteInvalidResolutionActionError);
  });

  it("should reject associating a deleted service", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const deletedService = makeService({ establishmentId });
    deletedService.softDelete(new Date("2026-07-13T10:00:00.000Z"));
    const quote = makeQuote({
      establishmentId,
      services: [
        {
          quoteServiceId,
          serviceId: null,
          serviceName: "Servico snapshot",
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    await servicesRepository.create(deletedService);

    await expect(
      sut.resolve({
        quote,
        establishmentId,
        analysis: analysis([
          serviceAnalysis({
            quoteServiceId: quoteServiceId.toString(),
            status: "CANDIDATE_FOUND",
            requiresResolution: true,
            allowedActions: ["ASSOCIATE_EXISTING"],
          }),
        ]),
        resolutions: [
          {
            quoteServiceId: quoteServiceId.toString(),
            action: "ASSOCIATE_EXISTING",
            serviceId: deletedService.id.toString(),
          },
        ],
      }),
    ).rejects.toBeInstanceOf(QuoteInvalidResolutionActionError);
  });
});

function analysis(services: QuoteServiceAnalysisItem[]): QuoteApprovalAnalysis {
  return {
    status: services.some((service) => service.requiresResolution)
      ? "REQUIRES_RESOLUTION"
      : "READY",
    automaticResolutions: [],
    customer: {
      status: "RESOLVED",
      requiresResolution: false,
      automaticCustomerId: "customer-1",
      candidates: [],
    },
    vehicle: {
      status: "NONE",
      requiresResolution: false,
      candidateVehicleId: null,
      candidateCustomerId: null,
      allowedActions: [],
    },
    services,
  };
}

function serviceAnalysis(
  override?: Partial<QuoteServiceAnalysisItem>,
): QuoteServiceAnalysisItem {
  return {
    quoteServiceId: "quote-service-1",
    status: "RESOLVED",
    requiresResolution: false,
    serviceId: null,
    candidateServiceId: null,
    snapshot: {
      name: "Servico snapshot",
      priceInCents: 5000,
      durationInMinutes: null,
      categoryId: null,
      categoryName: null,
      isCourtesy: false,
    },
    candidate: null,
    differences: [],
    allowedActions: [],
    ...override,
  };
}
