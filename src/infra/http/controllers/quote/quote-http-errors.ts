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

export function throwQuoteHttpError(error: Error): never {
  switch (error.constructor) {
    case NotAllowedError:
      throw new ForbiddenException(error.message);
    case ResourceNotFoundError:
      throw new NotFoundException(error.message);
    case ResourceAlreadyExistsError:
      throw new ConflictException(error.message);
    case InactiveServiceError:
    case InvalidQuoteInputError:
      throw new BadRequestException(error.message);
    case UnexpectedDomainError:
      throw new InternalServerErrorException(error.message);
    default:
      throw new BadRequestException(error.message);
  }
}
