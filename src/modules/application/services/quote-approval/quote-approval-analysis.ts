import { Quote } from "../../../quotes/domain/entities/quote";
import { ServicePriceSpecificationValue } from "../../../catalog/domain/value-objects/service-price-specification";

export type CustomerMatchReason = "CPF_CNPJ" | "PHONE" | "EMAIL" | "NAME";

export type QuoteCustomerCandidate = {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpfCnpj: string | null;
  matchedBy: CustomerMatchReason[];
  conflictingFields: Array<"NAME" | "PHONE" | "EMAIL">;
  advisoryOnly: boolean;
};

export type QuoteCustomerAnalysis = {
  status:
    | "RESOLVED"
    | "AUTO_LINK"
    | "CANDIDATES_FOUND"
    | "CREATE_REQUIRED"
    | "LINKED_RESOURCE_DELETED";
  requiresResolution: boolean;
  automaticCustomerId: string | null;
  candidates: QuoteCustomerCandidate[];
};

export type QuoteVehicleAnalysis = {
  status:
    | "NONE"
    | "RESOLVED"
    | "CANDIDATE_FOUND"
    | "SNAPSHOT_ONLY"
    | "OWNERSHIP_CONFLICT"
    | "LINKED_RESOURCE_DELETED";
  requiresResolution: boolean;
  candidateVehicleId: string | null;
  candidateCustomerId: string | null;
  allowedActions: Array<
    | "LINK_EXISTING"
    | "CREATE_FROM_SNAPSHOT"
    | "KEEP_SNAPSHOT_ONLY"
    | "EDIT_SNAPSHOT_PLATE"
  >;
};

export type QuoteServiceDifference =
  | "NAME"
  | "CATEGORY"
  | "DURATION"
  | "PRICE_SPECIFICATION"
  | "PRICE";

export type QuoteServiceAnalysisItem = {
  quoteServiceId: string;
  status:
    | "RESOLVED"
    | "READY_TO_CREATE"
    | "CANDIDATE_FOUND"
    | "LINKED_SERVICE_INACTIVE"
    | "LINKED_SERVICE_DELETED"
    | "LINKED_SERVICE_MISSING";
  requiresResolution: boolean;
  serviceId: string | null;
  candidateServiceId: string | null;
  snapshot: {
    name: string;
    priceInCents: number;
    durationInMinutes: number | null;
    categoryId: string | null;
    categoryName: string | null;
    isCourtesy: boolean;
  };
  candidate: {
    serviceId: string;
    name: string;
    isActive: boolean;
    priceSpecification: ServicePriceSpecificationValue;
    durationInMinutes: number | null;
    categoryId: string | null;
    categoryName: string | null;
  } | null;
  differences: QuoteServiceDifference[];
  allowedActions: Array<
    | "ASSOCIATE_EXISTING"
    | "KEEP_INACTIVE_LINK"
    | "RENAME_DETACHED"
    | "RECREATE_FROM_SNAPSHOT"
  >;
};

export type QuoteAutomaticResolution = {
  resource: "CUSTOMER";
  action: "LINK_EXISTING";
  resourceId: string;
  matchedBy: "CPF_CNPJ";
};

export type QuoteApprovalAnalysis = {
  status: "READY" | "REQUIRES_RESOLUTION";
  automaticResolutions: QuoteAutomaticResolution[];
  customer: QuoteCustomerAnalysis;
  vehicle: QuoteVehicleAnalysis;
  services: QuoteServiceAnalysisItem[];
};

export type AnalyzeQuoteApprovalInput = {
  quote: Quote;
  establishmentId: string;
};

export type QuoteCustomerRegistrationInput = {
  email?: string | null;
  phone?: string | null;
};

export type QuoteCustomerResolution =
  | { action: "LINK_EXISTING"; customerId: string }
  | ({ action: "CREATE_NEW" } & QuoteCustomerRegistrationInput);

export type QuoteVehicleResolution =
  | { action: "LINK_EXISTING"; vehicleId: string }
  | { action: "CREATE_FROM_SNAPSHOT" }
  | { action: "KEEP_SNAPSHOT_ONLY" }
  | { action: "EDIT_SNAPSHOT_PLATE"; plate: string };

export type QuoteServiceResolution =
  | {
      quoteServiceId: string;
      action: "ASSOCIATE_EXISTING";
      serviceId: string;
    }
  | { quoteServiceId: string; action: "KEEP_INACTIVE_LINK" }
  | {
      quoteServiceId: string;
      action: "RENAME_DETACHED";
      serviceName: string;
    }
  | { quoteServiceId: string; action: "RECREATE_FROM_SNAPSHOT" };
