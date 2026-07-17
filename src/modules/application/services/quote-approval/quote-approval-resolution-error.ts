import { QuoteApprovalAnalysis } from "./quote-approval-analysis";

export class QuoteApprovalResolutionRequiredError extends Error {
  readonly code = "QUOTE_APPROVAL_RESOLUTION_REQUIRED";

  constructor(public readonly analysis: QuoteApprovalAnalysis) {
    super("Quote approval requires resource resolution.");
    this.name = "QuoteApprovalResolutionRequiredError";
  }
}

export class QuoteApprovalConflictsChangedError extends Error {
  readonly code = "QUOTE_APPROVAL_CONFLICTS_CHANGED";

  constructor(public readonly analysis: QuoteApprovalAnalysis) {
    super("Quote approval conflicts changed.");
    this.name = "QuoteApprovalConflictsChangedError";
  }
}

export class QuoteInvalidResolutionActionError extends Error {
  readonly code = "QUOTE_INVALID_RESOLUTION_ACTION";

  constructor(message = "Invalid quote approval resolution action.") {
    super(message);
    this.name = "QuoteInvalidResolutionActionError";
  }
}
