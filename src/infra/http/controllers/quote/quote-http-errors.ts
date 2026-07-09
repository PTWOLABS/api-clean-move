import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

import { InactiveServiceError } from "../../../../modules/catalog/domain/errors/inactive-service-error";
import { InvalidQuoteInputError } from "../../../../modules/quotes/domain/errors/invalid-quote-input-error";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { createQuoteErrorResponse } from "./quote-error-response";

export function throwQuoteHttpError(error: Error): never {
  if (error instanceof NotAllowedError) {
    throw new ForbiddenException(
      createQuoteErrorResponse(403, "FORBIDDEN", error.message),
    );
  }

  if (error instanceof ResourceNotFoundError) {
    throw new NotFoundException(
      createQuoteErrorResponse(404, resourceNotFoundCode(error.resource), error.message),
    );
  }

  if (error instanceof ResourceAlreadyExistsError) {
    throw new ConflictException(
      createQuoteErrorResponse(409, resourceAlreadyExistsCode(error.resource), error.message),
    );
  }

  if (error instanceof InactiveServiceError) {
    throw new BadRequestException(
      createQuoteErrorResponse(400, "QUOTE_SERVICE_INACTIVE", error.message),
    );
  }

  if (error instanceof InvalidQuoteInputError) {
    throw new BadRequestException(
      createQuoteErrorResponse(400, error.code, error.message),
    );
  }

  const message =
    error instanceof UnexpectedDomainError
      ? error.message
      : "An unexpected error occurred.";

  throw new InternalServerErrorException(
    createQuoteErrorResponse(500, "INTERNAL_ERROR", message),
  );
}

function resourceNotFoundCode(resource: string | undefined) {
  switch (resource?.toLowerCase()) {
    case "quote":
      return "QUOTE_NOT_FOUND";
    case "customer":
      return "CUSTOMER_NOT_FOUND";
    case "vehicle":
      return "VEHICLE_NOT_FOUND";
    case "service":
      return "SERVICE_NOT_FOUND";
    case "establishment":
      return "ESTABLISHMENT_NOT_FOUND";
    default:
      return "RESOURCE_NOT_FOUND";
  }
}

function resourceAlreadyExistsCode(resource: string | undefined) {
  return resource?.toLowerCase() === "customer"
    ? "CUSTOMER_ALREADY_EXISTS"
    : "RESOURCE_ALREADY_EXISTS";
}
