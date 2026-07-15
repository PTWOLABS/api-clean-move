export type CustomerMatchReason = "CPF_CNPJ" | "PHONE" | "EMAIL" | "NAME";

export type QuoteCustomerCandidate = {
  customerId: string;
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
