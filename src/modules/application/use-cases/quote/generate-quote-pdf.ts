import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { QuotePdfGenerator } from "../../gateways/quote-pdf-generator";
import { QuotesRepository } from "../../repositories/quotes-repository";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";

type GenerateQuotePdfUseCaseRequest = {
  actor: EstablishmentScopeActor;
  quoteId: string;
};

type GenerateQuotePdfUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    pdf: Buffer;
    contentType: "application/pdf";
    fileName: string;
  }
>;

@Injectable()
export class GenerateQuotePdfUseCase {
  constructor(
    private quotesRepository: QuotesRepository,
    private establishmentScope: EstablishmentScopeService,
    private quotePdfGenerator: QuotePdfGenerator,
  ) {}

  async execute({
    actor,
    quoteId,
  }: GenerateQuotePdfUseCaseRequest): Promise<GenerateQuotePdfUseCaseResponse> {
    const scope = await this.establishmentScope.resolve(actor);
    if (scope.isLeft()) return left(scope.value);

    const quote = await this.quotesRepository.findByIdAndEstablishmentId(
      quoteId,
      scope.value.establishment.id.toString(),
    );

    if (!quote) return left(new ResourceNotFoundError({ resource: "quote" }));

    const pdf = await this.quotePdfGenerator.generate(quote);

    return right({
      pdf,
      contentType: "application/pdf",
      fileName: `quote-${quote.id.toString()}.pdf`,
    });
  }
}
