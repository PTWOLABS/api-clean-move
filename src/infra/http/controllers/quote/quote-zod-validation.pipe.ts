import {
  BadRequestException,
  HttpStatus,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from "@nestjs/common";
import { z } from "zod";

import type {
  QuoteErrorResponse,
  QuoteFieldError,
  QuoteValidationFieldCode,
} from "./quote-error-response";

type ZodIssue = z.ZodError["issues"][number];

export function formatQuoteValidationIssues(
  error: z.ZodError,
): QuoteFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    code: toQuoteValidationFieldCode(issue),
  }));
}

function toQuoteValidationFieldCode(
  issue: ZodIssue,
): QuoteValidationFieldCode {
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined ? "REQUIRED" : "INVALID_TYPE";
    case "invalid_format":
    case "invalid_value":
      return "INVALID_FORMAT";
    case "too_small":
      return isCollection(issue.origin) ? "MIN_ITEMS" : "OUT_OF_RANGE";
    case "too_big":
      return isCollection(issue.origin) ? "MAX_ITEMS" : "OUT_OF_RANGE";
    default:
      return "INVALID_VALUE";
  }
}

function isCollection(origin: string) {
  return origin === "array" || origin === "string" || origin === "set";
}

@Injectable()
export class QuoteZodValidationPipe<
  TSchema extends z.ZodTypeAny,
> implements PipeTransform<unknown, z.output<TSchema>> {
  constructor(private readonly schema: TSchema) {}

  transform(
    value: unknown,
    _metadata: ArgumentMetadata,
  ): z.output<TSchema> {
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      errors: formatQuoteValidationIssues(result.error),
    } satisfies QuoteErrorResponse);
  }
}
