import { QuoteApprovalAnalysis } from "../../../../modules/application/services/quote-approval/quote-approval-analysis";
import {
  QuoteApprovalConflictsChangedError,
  QuoteApprovalResolutionRequiredError,
} from "../../../../modules/application/services/quote-approval/quote-approval-resolution-error";

export type QuoteValidationFieldCode =
  | "REQUIRED"
  | "INVALID_TYPE"
  | "INVALID_FORMAT"
  | "OUT_OF_RANGE"
  | "MIN_ITEMS"
  | "MAX_ITEMS"
  | "INVALID_VALUE";

export type QuoteFieldError = {
  field: string;
  code: QuoteValidationFieldCode;
};

export type QuoteErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
  errors?: QuoteFieldError[];
  analysis?: QuoteApprovalAnalysis;
};

export function createQuoteErrorResponse(
  statusCode: number,
  code: string,
  message: string,
): QuoteErrorResponse {
  return { statusCode, code, message };
}

export function createQuoteConflictResponse(
  error:
    | QuoteApprovalResolutionRequiredError
    | QuoteApprovalConflictsChangedError,
): QuoteErrorResponse {
  return {
    statusCode: 409,
    code: error.code,
    message: error.message,
    analysis: error.analysis,
  };
}
