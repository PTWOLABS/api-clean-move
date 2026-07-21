import { vi } from "vitest";

import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import {
  QuoteCustomerAnalysis,
  QuoteServiceAnalysisItem,
  QuoteVehicleAnalysis,
} from "./quote-approval-analysis";
import { QuoteApprovalAnalyzer } from "./quote-approval-analyzer";

describe("Quote approval analyzer", () => {
  it("should compose ready analysis with automatic document customer resolution", async () => {
    const quote = makeQuote();
    const customerMatcher = {
      analyze: vi.fn().mockResolvedValue(
        customerAnalysis({
          status: "AUTO_LINK",
          requiresResolution: false,
          automaticCustomerId: "customer-1",
        }),
      ),
    };
    const vehicleMatcher = {
      analyze: vi.fn().mockResolvedValue(vehicleAnalysis()),
    };
    const serviceMatcher = {
      analyze: vi.fn().mockResolvedValue([]),
    };
    const sut = new QuoteApprovalAnalyzer(
      customerMatcher as never,
      vehicleMatcher as never,
      serviceMatcher as never,
    );

    const ready = await sut.analyze({
      quote,
      establishmentId: "establishment-1",
    });

    expect(ready.status).toBe("READY");
    expect(ready.automaticResolutions).toEqual([
      {
        resource: "CUSTOMER",
        action: "LINK_EXISTING",
        resourceId: "customer-1",
        matchedBy: "CPF_CNPJ",
      },
    ]);
    expect(customerMatcher.analyze).toHaveBeenCalledWith({
      quote,
      establishmentId: "establishment-1",
    });
    expect(vehicleMatcher.analyze).toHaveBeenCalledWith({
      quote,
      establishmentId: "establishment-1",
      resolvedCustomerId: "customer-1",
    });
  });

  it("should pass the linked quote customer to vehicle analysis when there is no automatic match", async () => {
    const customerId = new UniqueEntityId("customer-linked");
    const quote = makeQuote({ customerId });
    const customerMatcher = {
      analyze: vi.fn().mockResolvedValue(customerAnalysis()),
    };
    const vehicleMatcher = {
      analyze: vi.fn().mockResolvedValue(vehicleAnalysis()),
    };
    const serviceMatcher = {
      analyze: vi.fn().mockResolvedValue([]),
    };
    const sut = new QuoteApprovalAnalyzer(
      customerMatcher as never,
      vehicleMatcher as never,
      serviceMatcher as never,
    );

    await sut.analyze({ quote, establishmentId: "establishment-1" });

    expect(vehicleMatcher.analyze).toHaveBeenCalledWith({
      quote,
      establishmentId: "establishment-1",
      resolvedCustomerId: customerId.toString(),
    });
  });

  it("should require resolution when a service item requires a decision", async () => {
    const customerMatcher = {
      analyze: vi.fn().mockResolvedValue(customerAnalysis()),
    };
    const vehicleMatcher = {
      analyze: vi.fn().mockResolvedValue(vehicleAnalysis()),
    };
    const serviceMatcher = {
      analyze: vi
        .fn()
        .mockResolvedValue([serviceAnalysis({ requiresResolution: true })]),
    };
    const sut = new QuoteApprovalAnalyzer(
      customerMatcher as never,
      vehicleMatcher as never,
      serviceMatcher as never,
    );

    const withServiceConflict = await sut.analyze({
      quote: makeQuote(),
      establishmentId: "establishment-1",
    });

    expect(withServiceConflict.status).toBe("REQUIRES_RESOLUTION");
  });

  it.each([
    {
      name: "customer",
      customer: customerAnalysis({
        status: "CANDIDATES_FOUND",
        requiresResolution: true,
      }),
      vehicle: vehicleAnalysis(),
      services: [],
    },
    {
      name: "vehicle",
      customer: customerAnalysis(),
      vehicle: vehicleAnalysis({
        status: "SNAPSHOT_ONLY",
        requiresResolution: true,
      }),
      services: [],
    },
  ])(
    "should require resolution when $name analysis requires a decision",
    async ({ customer, vehicle, services }) => {
      const sut = new QuoteApprovalAnalyzer(
        { analyze: vi.fn().mockResolvedValue(customer) } as never,
        { analyze: vi.fn().mockResolvedValue(vehicle) } as never,
        { analyze: vi.fn().mockResolvedValue(services) } as never,
      );

      const analysis = await sut.analyze({
        quote: makeQuote(),
        establishmentId: "establishment-1",
      });

      expect(analysis.status).toBe("REQUIRES_RESOLUTION");
    },
  );

  it("should require resolution for advisory-only customer candidates", async () => {
    const sut = new QuoteApprovalAnalyzer(
      {
        analyze: vi.fn().mockResolvedValue(
          customerAnalysis({
            status: "CANDIDATES_FOUND",
            requiresResolution: true,
            candidates: [
              {
                customerId: "customer-1",
                matchedBy: ["NAME"],
                conflictingFields: [],
                advisoryOnly: true,
              },
            ],
          }),
        ),
      } as never,
      { analyze: vi.fn().mockResolvedValue(vehicleAnalysis()) } as never,
      { analyze: vi.fn().mockResolvedValue([]) } as never,
    );

    const analysis = await sut.analyze({
      quote: makeQuote(),
      establishmentId: "establishment-1",
    });

    expect(analysis.status).toBe("REQUIRES_RESOLUTION");
  });
});

function customerAnalysis(
  override?: Partial<QuoteCustomerAnalysis>,
): QuoteCustomerAnalysis {
  return {
    status: "RESOLVED",
    requiresResolution: false,
    automaticCustomerId: null,
    candidates: [],
    ...override,
  };
}

function vehicleAnalysis(
  override?: Partial<QuoteVehicleAnalysis>,
): QuoteVehicleAnalysis {
  return {
    status: "NONE",
    requiresResolution: false,
    candidateVehicleId: null,
    candidateCustomerId: null,
    allowedActions: [],
    ...override,
  };
}

function serviceAnalysis(
  override?: Partial<QuoteServiceAnalysisItem>,
): QuoteServiceAnalysisItem {
  return {
    quoteServiceId: "quote-service-1",
    status: "RESOLVED",
    requiresResolution: false,
    serviceId: "service-1",
    candidateServiceId: "service-1",
    snapshot: {
      name: "Lavagem",
      priceInCents: 5000,
      durationInMinutes: 60,
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
