import { Injectable } from "@nestjs/common";

import { Service } from "../../../catalog/domain/entities/services";
import { EstimatedDuration } from "../../../catalog/domain/value-objects/estimated-duration";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";
import { ServicePriceSpecification } from "../../../catalog/domain/value-objects/service-price-specification";
import { Quote } from "../../../quotes/domain/entities/quote";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { QuotedServiceSnapshot } from "../../../quotes/domain/value-objects/quoted-service-snapshot";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { ServicesRepository } from "../../repositories/services-repository";
import {
  QuoteApprovalAnalysis,
  QuoteServiceResolution,
} from "./quote-approval-analysis";
import { QuoteInvalidResolutionActionError } from "./quote-approval-resolution-error";
import { validateQuoteServiceResolutions } from "./quote-approval-resolution-validation";

type QuoteServiceResolverInput = {
  quote: Quote;
  establishmentId: UniqueEntityId;
  analysis: QuoteApprovalAnalysis;
  resolutions: QuoteServiceResolution[];
};

@Injectable()
export class QuoteServiceResolver {
  constructor(private readonly servicesRepository: ServicesRepository) {}

  async resolve({
    quote,
    establishmentId,
    analysis,
    resolutions,
  }: QuoteServiceResolverInput): Promise<void> {
    validateQuoteServiceResolutions(analysis, resolutions);

    const decisionsByItemId = new Map(
      resolutions.map((resolution) => [resolution.quoteServiceId, resolution]),
    );

    for (const item of analysis.services) {
      const quoteService = this.findQuoteService(quote, item.quoteServiceId);
      const decision = decisionsByItemId.get(item.quoteServiceId);

      if (!decision && item.status === "READY_TO_CREATE") {
        await this.materializeSnapshot(quote, quoteService, establishmentId);
        continue;
      }

      if (!decision) {
        continue;
      }

      if (decision.action === "KEEP_INACTIVE_LINK") {
        continue;
      }

      if (decision.action === "ASSOCIATE_EXISTING") {
        const service = await this.findResolutionTarget(
          decision.serviceId,
          establishmentId.toString(),
        );

        quote.associateService(
          quoteService.quoteServiceId,
          service.id,
          new Date(),
        );
        continue;
      }

      if (decision.action === "RENAME_DETACHED") {
        await this.assertServiceNameAvailable(
          decision.serviceName,
          establishmentId.toString(),
        );
        quote.renameDetachedService(
          quoteService.quoteServiceId,
          decision.serviceName,
          new Date(),
        );
        await this.materializeSnapshot(
          quote,
          this.findQuoteService(quote, item.quoteServiceId),
          establishmentId,
        );
        continue;
      }

      await this.materializeSnapshot(quote, quoteService, establishmentId);
    }
  }

  private findQuoteService(quote: Quote, quoteServiceId: string) {
    const quoteService = quote.services.find(
      (service) => service.quoteServiceId.toString() === quoteServiceId,
    );

    if (!quoteService) {
      throw new QuoteInvalidResolutionActionError(
        "Quote service resolution item was not found.",
      );
    }

    return quoteService;
  }

  private async findResolutionTarget(
    serviceId: string,
    establishmentId: string,
  ) {
    const service =
      await this.servicesRepository.findByServiceIdAndEstablishmentId(
        serviceId,
        establishmentId,
      );

    if (!service || service.isDeleted()) {
      throw new QuoteInvalidResolutionActionError(
        "Service resolution target was not found.",
      );
    }

    return service;
  }

  private async assertServiceNameAvailable(
    serviceName: string,
    establishmentId: string,
  ) {
    const existingService =
      await this.servicesRepository.findActiveByNameAndEstablishmentId(
        serviceName,
        establishmentId,
      );

    if (existingService) {
      throw new InvalidQuoteInputError(
        "Service name is unavailable.",
        "QUOTE_SERVICE_NAME_UNAVAILABLE",
      );
    }
  }

  private async materializeSnapshot(
    quote: Quote,
    quoteService: QuotedServiceSnapshot,
    establishmentId: UniqueEntityId,
  ) {
    await this.assertServiceNameAvailable(
      quoteService.serviceName,
      establishmentId.toString(),
    );

    const service = Service.create({
      establishmentId,
      serviceName: ServiceName.create(quoteService.serviceName),
      category: quoteService.category,
      estimatedDuration: quoteService.durationInMinutes
        ? EstimatedDuration.create({
            minInMinutes: quoteService.durationInMinutes,
            maxInMinutes: quoteService.durationInMinutes,
          })
        : undefined,
      priceSpecification: ServicePriceSpecification.create({
        type: "FIXED",
        fixedPriceInCents: quoteService.priceInCents,
      }),
      isActive: true,
    });

    await this.servicesRepository.create(service);
    quote.associateService(quoteService.quoteServiceId, service.id, new Date());

    return service;
  }
}
