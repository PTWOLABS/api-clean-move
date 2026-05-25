import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Quote } from "../../../quotes/domain/entities/quote";
import {
  QuoteFilters,
  QuotesRepository,
} from "../../repositories/quotes-repository";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";

type ListQuotesUseCaseRequest = {
  actor: EstablishmentScopeActor;
  filters?: QuoteFilters;
};

type ListQuotesUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    quotes: Quote[];
  }
>;

@Injectable()
export class ListQuotesUseCase {
  constructor(
    private quotesRepository: QuotesRepository,
    private establishmentScope: EstablishmentScopeService,
  ) {}

  async execute({
    actor,
    filters,
  }: ListQuotesUseCaseRequest): Promise<ListQuotesUseCaseResponse> {
    const scope = await this.establishmentScope.resolve(actor);
    if (scope.isLeft()) return left(scope.value);

    const quotes = await this.quotesRepository.findManyByEstablishmentId(
      scope.value.establishment.id.toString(),
      filters,
    );

    return right({ quotes });
  }
}
