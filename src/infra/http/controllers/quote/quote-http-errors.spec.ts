import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

import { InactiveServiceError } from "../../../../modules/catalog/domain/errors/inactive-service-error";
import { InvalidQuoteInputError } from "../../../../modules/quotes/domain/errors/invalid-quote-input-error";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { throwQuoteHttpError } from "./quote-http-errors";

function captureException(error: Error): HttpException {
  try {
    throwQuoteHttpError(error);
  } catch (exception) {
    expect(exception).toBeInstanceOf(HttpException);
    return exception as HttpException;
  }
}

describe("throwQuoteHttpError", () => {
  it.each([
    ["quote", "QUOTE_NOT_FOUND"],
    ["customer", "CUSTOMER_NOT_FOUND"],
    ["vehicle", "VEHICLE_NOT_FOUND"],
    ["service", "SERVICE_NOT_FOUND"],
    ["establishment", "ESTABLISHMENT_NOT_FOUND"],
    ["owner", "RESOURCE_NOT_FOUND"],
  ])("should map a missing %s to %s", (resource, code) => {
    const exception = captureException(new ResourceNotFoundError({ resource }));

    expect(exception).toBeInstanceOf(NotFoundException);
    expect(exception.getResponse()).toMatchObject({ statusCode: 404, code });
  });

  it("should map each quote error category to its HTTP contract", () => {
    expect(captureException(new NotAllowedError())).toBeInstanceOf(
      ForbiddenException,
    );
    expect(captureException(new NotAllowedError()).getResponse()).toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    expect(
      captureException(
        new ResourceAlreadyExistsError({
          message: "Customer already registered.",
          resource: "customer",
        }),
      ),
    ).toBeInstanceOf(ConflictException);
    expect(
      captureException(new InactiveServiceError("Polimento")).getResponse(),
    ).toMatchObject({ statusCode: 400, code: "QUOTE_SERVICE_INACTIVE" });
    expect(
      captureException(
        new InvalidQuoteInputError(
          "Quote is already converted.",
          "QUOTE_ALREADY_CONVERTED",
        ),
      ),
    ).toBeInstanceOf(BadRequestException);
    expect(
      captureException(
        new InvalidQuoteInputError(
          "Quote is already converted.",
          "QUOTE_ALREADY_CONVERTED",
        ),
      ).getResponse(),
    ).toMatchObject({ statusCode: 400, code: "QUOTE_ALREADY_CONVERTED" });
    expect(captureException(new UnexpectedDomainError())).toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(captureException(new Error("raw error")).getResponse()).toEqual({
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    });
  });
});
