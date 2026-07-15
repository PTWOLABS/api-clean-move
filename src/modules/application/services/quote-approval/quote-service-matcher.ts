import { Injectable } from "@nestjs/common";

import { Service } from "../../../catalog/domain/entities/services";
import { ServicePriceSpecificationValue } from "../../../catalog/domain/value-objects/service-price-specification";
import { Quote } from "../../../quotes/domain/entities/quote";
import { QuotedServiceSnapshot } from "../../../quotes/domain/value-objects/quoted-service-snapshot";
import { ServicesRepository } from "../../repositories/services-repository";
import {
  QuoteServiceAnalysisItem,
  QuoteServiceDifference,
} from "./quote-approval-analysis";
import {
  normalizeQuoteApprovalNullableText,
  normalizeQuoteApprovalText,
} from "./quote-approval-evidence";

type QuoteServiceMatcherInput = {
  quote: Quote;
  establishmentId: string;
};

@Injectable()
export class QuoteServiceMatcher {
  constructor(private readonly servicesRepository: ServicesRepository) {}

  async analyze({
    quote,
    establishmentId,
  }: QuoteServiceMatcherInput): Promise<QuoteServiceAnalysisItem[]> {
    const quoteServices = quote.services;
    const linkedServiceIds = quoteServices
      .map((service) => service.serviceId?.toString())
      .filter((serviceId): serviceId is string => serviceId !== undefined);
    const linkedServices =
      linkedServiceIds.length > 0
        ? await this.servicesRepository.findManyByIdsAndEstablishmentIdIncludingDeleted(
            linkedServiceIds,
            establishmentId,
          )
        : [];
    const linkedServicesById = new Map(
      linkedServices.map((service) => [service.id.toString(), service]),
    );
    const analysis: QuoteServiceAnalysisItem[] = [];

    for (const quoteService of quoteServices) {
      if (quoteService.serviceId) {
        analysis.push(
          this.analyzeLinkedService(
            quoteService,
            linkedServicesById.get(quoteService.serviceId.toString()) ?? null,
          ),
        );
        continue;
      }

      analysis.push(
        await this.analyzeDetachedService(quoteService, establishmentId),
      );
    }

    return analysis;
  }

  private analyzeLinkedService(
    quoteService: QuotedServiceSnapshot,
    service: Service | null,
  ): QuoteServiceAnalysisItem {
    if (!service) {
      return {
        ...baseAnalysis(quoteService, null),
        status: "LINKED_SERVICE_MISSING",
        requiresResolution: true,
        serviceId: quoteService.serviceId!.toString(),
        allowedActions: ["ASSOCIATE_EXISTING", "RECREATE_FROM_SNAPSHOT"],
      };
    }

    if (service.isDeleted()) {
      return {
        ...baseAnalysis(quoteService, service),
        status: "LINKED_SERVICE_DELETED",
        requiresResolution: true,
        allowedActions: ["ASSOCIATE_EXISTING", "RECREATE_FROM_SNAPSHOT"],
      };
    }

    if (!service.isActive) {
      return {
        ...baseAnalysis(quoteService, service),
        status: "LINKED_SERVICE_INACTIVE",
        requiresResolution: true,
        allowedActions: ["KEEP_INACTIVE_LINK", "ASSOCIATE_EXISTING"],
      };
    }

    return {
      ...baseAnalysis(quoteService, service),
      status: "RESOLVED",
      requiresResolution: false,
      allowedActions: [],
    };
  }

  private async analyzeDetachedService(
    quoteService: QuotedServiceSnapshot,
    establishmentId: string,
  ): Promise<QuoteServiceAnalysisItem> {
    const candidate =
      await this.servicesRepository.findActiveByNameAndEstablishmentId(
        quoteService.serviceName,
        establishmentId,
      );

    if (!candidate) {
      return {
        ...baseAnalysis(quoteService, null),
        status: "READY_TO_CREATE",
        requiresResolution: false,
        allowedActions: [],
      };
    }

    return {
      ...baseAnalysis(quoteService, candidate),
      status: "CANDIDATE_FOUND",
      requiresResolution: true,
      allowedActions: [
        "ASSOCIATE_EXISTING",
        "RENAME_DETACHED",
        "RECREATE_FROM_SNAPSHOT",
      ],
    };
  }
}

function baseAnalysis(
  quoteService: QuotedServiceSnapshot,
  candidate: Service | null,
): Omit<
  QuoteServiceAnalysisItem,
  "status" | "requiresResolution" | "allowedActions"
> {
  return {
    quoteServiceId: quoteService.quoteServiceId.toString(),
    serviceId: quoteService.serviceId?.toString() ?? null,
    candidateServiceId: candidate?.id.toString() ?? null,
    snapshot: toSnapshotPayload(quoteService),
    candidate: candidate ? toCandidatePayload(candidate) : null,
    differences: candidate ? getDifferences(quoteService, candidate) : [],
  };
}

function toSnapshotPayload(quoteService: QuotedServiceSnapshot) {
  return {
    name: quoteService.serviceName,
    priceInCents: quoteService.priceInCents,
    durationInMinutes: quoteService.durationInMinutes ?? null,
    categoryId: quoteService.category?.id.toString() ?? null,
    categoryName: quoteService.category?.name ?? null,
    isCourtesy: quoteService.isCourtesy,
  };
}

function toCandidatePayload(service: Service) {
  return {
    serviceId: service.id.toString(),
    name: service.serviceName.value,
    isActive: service.isActive,
    priceSpecification: service.priceSpecification.toValue(),
    durationInMinutes: service.estimatedDuration?.upperBoundInMinutes ?? null,
    categoryId: service.category?.id.toString() ?? null,
    categoryName: service.category?.name ?? null,
  };
}

function getDifferences(
  quoteService: QuotedServiceSnapshot,
  service: Service,
): QuoteServiceDifference[] {
  const differences: QuoteServiceDifference[] = [];
  const snapshot = toSnapshotPayload(quoteService);
  const candidate = toCandidatePayload(service);

  if (
    normalizeQuoteApprovalText(snapshot.name) !==
    normalizeQuoteApprovalText(candidate.name)
  ) {
    differences.push("NAME");
  }

  if (
    snapshot.categoryId !== candidate.categoryId ||
    normalizeQuoteApprovalNullableText(snapshot.categoryName) !==
      normalizeQuoteApprovalNullableText(candidate.categoryName)
  ) {
    differences.push("CATEGORY");
  }

  if (snapshot.durationInMinutes !== candidate.durationInMinutes) {
    differences.push("DURATION");
  }

  if (
    !priceSpecificationsAreEqual(
      snapshotPriceSpecification(quoteService),
      candidate.priceSpecification,
    )
  ) {
    differences.push("PRICE_SPECIFICATION");
  }

  if (
    quoteService.priceInCents !==
    service.priceSpecification.defaultChargePriceInCents
  ) {
    differences.push("PRICE");
  }

  return differences;
}

function snapshotPriceSpecification(
  quoteService: QuotedServiceSnapshot,
): ServicePriceSpecificationValue {
  return {
    type: "FIXED",
    fixedPriceInCents: quoteService.priceInCents,
  };
}

function priceSpecificationsAreEqual(
  left: ServicePriceSpecificationValue,
  right: ServicePriceSpecificationValue,
) {
  if (left.type !== right.type) {
    return false;
  }

  if (left.type === "FIXED") {
    return left.fixedPriceInCents === right.fixedPriceInCents;
  }

  if (left.type === "STARTING_AT") {
    return left.minPriceInCents === right.minPriceInCents;
  }

  return (
    left.minPriceInCents === right.minPriceInCents &&
    left.maxPriceInCents === right.maxPriceInCents
  );
}
