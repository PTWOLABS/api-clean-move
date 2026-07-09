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
};
