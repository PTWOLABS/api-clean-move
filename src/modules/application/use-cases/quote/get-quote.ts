import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Quote } from "../../../quotes/domain/entities/quote";
import { QuotesRepository } from "../../repositories/quotes-repository";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";

type GetQuoteUseCaseRequest = {
  actor: EstablishmentScopeActor;
  quoteId: string;
};

type GetQuoteUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    quote: Quote;
  }
>;

@Injectable()
export class GetQuoteUseCase {
  constructor(
    private quotesRepository: QuotesRepository,
    private establishmentScope: EstablishmentScopeService,
  ) {}

  async execute({
    actor,
    quoteId,
  }: GetQuoteUseCaseRequest): Promise<GetQuoteUseCaseResponse> {
    const scope = await this.establishmentScope.resolve(actor);
    if (scope.isLeft()) return left(scope.value);

    const quote = await this.quotesRepository.findByIdAndEstablishmentId(
      quoteId,
      scope.value.establishment.id.toString(),
    );

    if (!quote) return left(new ResourceNotFoundError({ resource: "quote" }));
    return right({ quote });
  }
}
