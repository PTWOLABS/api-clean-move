import {
  QuoteApprovalAnalysis,
  QuoteCustomerResolution,
  QuoteServiceResolution,
  QuoteVehicleResolution,
} from "./quote-approval-analysis";
import {
  QuoteApprovalResolutionRequiredError,
  QuoteInvalidResolutionActionError,
} from "./quote-approval-resolution-error";

export function validateQuoteApprovalResolutions(
  analysis: QuoteApprovalAnalysis,
  input: {
    customerResolution?: QuoteCustomerResolution;
    vehicleResolution?: QuoteVehicleResolution;
    serviceResolutions?: QuoteServiceResolution[];
  },
): void {
  validateCustomerResolution(analysis, input.customerResolution);
  validateVehicleResolution(analysis, input.vehicleResolution);
  validateServiceResolutions(analysis, input.serviceResolutions ?? []);
}

function validateCustomerResolution(
  analysis: QuoteApprovalAnalysis,
  resolution?: QuoteCustomerResolution,
) {
  if (analysis.customer.requiresResolution && !resolution) {
    throw new QuoteApprovalResolutionRequiredError(analysis);
  }

  if (!resolution) {
    return;
  }

  if (
    !analysis.customer.requiresResolution &&
    analysis.customer.status !== "CANDIDATES_FOUND"
  ) {
    throw new QuoteInvalidResolutionActionError(
      "Customer resolution is not applicable.",
    );
  }

  if (
    resolution.action === "LINK_EXISTING" &&
    analysis.customer.status !== "CANDIDATES_FOUND" &&
    analysis.customer.status !== "LINKED_RESOURCE_DELETED"
  ) {
    throw new QuoteInvalidResolutionActionError(
      "Customer link resolution is not applicable.",
    );
  }

  if (
    resolution.action === "CREATE_NEW" &&
    analysis.customer.status !== "CREATE_REQUIRED" &&
    analysis.customer.status !== "CANDIDATES_FOUND" &&
    analysis.customer.status !== "LINKED_RESOURCE_DELETED"
  ) {
    throw new QuoteInvalidResolutionActionError(
      "Customer create resolution is not applicable.",
    );
  }
}

function validateVehicleResolution(
  analysis: QuoteApprovalAnalysis,
  resolution?: QuoteVehicleResolution,
) {
  if (analysis.vehicle.requiresResolution && !resolution) {
    throw new QuoteApprovalResolutionRequiredError(analysis);
  }

  if (!resolution) {
    return;
  }

  if (!analysis.vehicle.allowedActions.includes(resolution.action)) {
    throw new QuoteInvalidResolutionActionError(
      "Vehicle resolution action is not applicable.",
    );
  }
}

function validateServiceResolutions(
  analysis: QuoteApprovalAnalysis,
  resolutions: QuoteServiceResolution[],
) {
  validateQuoteServiceResolutions(analysis, resolutions);
}

export function validateQuoteServiceResolutions(
  analysis: QuoteApprovalAnalysis,
  resolutions: QuoteServiceResolution[],
) {
  const itemsById = new Map(
    analysis.services.map((service) => [service.quoteServiceId, service]),
  );
  const seen = new Set<string>();

  for (const resolution of resolutions) {
    if (seen.has(resolution.quoteServiceId)) {
      throw new QuoteInvalidResolutionActionError(
        "Duplicate quote service resolution.",
      );
    }

    seen.add(resolution.quoteServiceId);

    const item = itemsById.get(resolution.quoteServiceId);

    if (!item) {
      throw new QuoteInvalidResolutionActionError(
        "Quote service resolution item was not found.",
      );
    }

    if (!item.allowedActions.includes(resolution.action)) {
      throw new QuoteInvalidResolutionActionError(
        "Quote service resolution action is not applicable.",
      );
    }
  }

  const missingRequired = analysis.services.some(
    (service) =>
      service.requiresResolution && !seen.has(service.quoteServiceId),
  );

  if (missingRequired) {
    throw new QuoteApprovalResolutionRequiredError(analysis);
  }
}
