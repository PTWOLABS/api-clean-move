import { Injectable } from "@nestjs/common";

import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";
import { QuoteApprovalAnalysis } from "../../services/quote-approval/quote-approval-analysis";
import { QuoteApprovalAnalyzer } from "../../services/quote-approval/quote-approval-analyzer";
import { validateQuoteApprovalSchedule } from "../../services/quote-approval/quote-approval-schedule";
import { QuotesRepository } from "../../repositories/quotes-repository";

export type AnalyzeQuoteApprovalUseCaseRequest = {
  actor: EstablishmentScopeActor;
  quoteId: string;
  startsAt: Date;
  endsAt?: Date | null;
  prospectEmail?: string;
};

type AnalyzeQuoteApprovalUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError | InvalidQuoteInputError,
  {
    analysis: QuoteApprovalAnalysis;
  }
>;

@Injectable()
export class AnalyzeQuoteApprovalUseCase {
  constructor(
    private readonly quotesRepository: QuotesRepository,
    private readonly establishmentScope: EstablishmentScopeService,
    private readonly analyzer: QuoteApprovalAnalyzer,
  ) {}

  async execute(
    request: AnalyzeQuoteApprovalUseCaseRequest,
  ): Promise<AnalyzeQuoteApprovalUseCaseResponse> {
    const scope = await this.establishmentScope.resolve(request.actor);
    if (scope.isLeft()) return left(scope.value);

    const establishmentId = scope.value.establishment.id.toString();
    const quote = await this.quotesRepository.findByIdAndEstablishmentId(
      request.quoteId,
      establishmentId,
    );

    if (!quote) {
      return left(new ResourceNotFoundError({ resource: "quote" }));
    }

    if (quote.convertedAppointmentId || quote.convertedAt) {
      return left(
        new InvalidQuoteInputError(
          "Quote is already converted.",
          "QUOTE_ALREADY_CONVERTED",
        ),
      );
    }

    try {
      validateQuoteApprovalSchedule(request.startsAt, request.endsAt ?? null);
    } catch (error) {
      if (error instanceof InvalidQuoteInputError) {
        return left(error);
      }

      throw error;
    }

    const analysis = await this.analyzer.analyze({
      quote,
      establishmentId,
      ...(request.prospectEmail
        ? { prospectEmail: request.prospectEmail }
        : {}),
    });

    return right({ analysis });
  }
}
