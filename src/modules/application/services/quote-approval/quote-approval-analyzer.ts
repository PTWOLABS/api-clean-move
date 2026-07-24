import { Injectable } from "@nestjs/common";

import {
  AnalyzeQuoteApprovalInput,
  QuoteApprovalAnalysis,
  QuoteAutomaticResolution,
} from "./quote-approval-analysis";
import { QuoteCustomerMatcher } from "./quote-customer-matcher";
import { QuoteServiceMatcher } from "./quote-service-matcher";
import { QuoteVehicleMatcher } from "./quote-vehicle-matcher";

@Injectable()
export class QuoteApprovalAnalyzer {
  constructor(
    private readonly customerMatcher: QuoteCustomerMatcher,
    private readonly vehicleMatcher: QuoteVehicleMatcher,
    private readonly serviceMatcher: QuoteServiceMatcher,
  ) {}

  async analyze(
    input: AnalyzeQuoteApprovalInput,
  ): Promise<QuoteApprovalAnalysis> {
    const customer = await this.customerMatcher.analyze({
      quote: input.quote,
      establishmentId: input.establishmentId,
    });
    const resolvedCustomerId =
      customer.automaticCustomerId ??
      input.quote.customerId?.toString() ??
      null;
    const vehicle = await this.vehicleMatcher.analyze({
      quote: input.quote,
      establishmentId: input.establishmentId,
      resolvedCustomerId,
    });
    const services = await this.serviceMatcher.analyze({
      quote: input.quote,
      establishmentId: input.establishmentId,
    });
    const automaticResolutions = getAutomaticResolutions(customer);
    const requiresResolution =
      customer.requiresResolution ||
      vehicle.requiresResolution ||
      services.some((service) => service.requiresResolution);

    return {
      status: requiresResolution ? "REQUIRES_RESOLUTION" : "READY",
      automaticResolutions,
      customer,
      vehicle,
      services,
    };
  }
}

function getAutomaticResolutions(
  customer: QuoteApprovalAnalysis["customer"],
): QuoteAutomaticResolution[] {
  if (customer.status !== "AUTO_LINK" || !customer.automaticCustomerId) {
    return [];
  }

  return [
    {
      resource: "CUSTOMER",
      action: "LINK_EXISTING",
      resourceId: customer.automaticCustomerId,
      matchedBy: "CPF_CNPJ",
    },
  ];
}
