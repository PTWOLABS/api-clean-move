import { Injectable } from "@nestjs/common";

import { Appointment } from "../../../scheduling/domain/entities/appointment";
import { Quote } from "../../../quotes/domain/entities/quote";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { QuotesRepository } from "../../repositories/quotes-repository";
import { UnitOfWork } from "../../repositories/unit-of-work";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";
import {
  QuoteApprovalResolutionRequiredError,
  QuoteInvalidResolutionActionError,
} from "../../services/quote-approval/quote-approval-resolution-error";
import { validateQuoteApprovalSchedule } from "../../services/quote-approval/quote-approval-schedule";
import { QuoteApprovalAnalyzer } from "../../services/quote-approval/quote-approval-analyzer";
import { QuoteServiceResolver } from "../../services/quote-approval/quote-service-resolver";
import { QuoteToAppointmentConverter } from "../../services/quote-approval/quote-to-appointment-converter";

type ApproveQuoteUseCaseRequest = {
  actor: EstablishmentScopeActor;
  quoteId: string;
  startsAt: Date;
  endsAt?: Date | null;
};

type ApproveQuoteUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InvalidQuoteInputError
  | UnexpectedDomainError,
  {
    appointment: Appointment;
    quote: Quote;
  }
>;

type ApprovalDispatchResponse = Either<
  ResourceNotFoundError | InvalidQuoteInputError,
  {
    appointment: Appointment;
    quote: Quote;
  }
>;

@Injectable()
export class ApproveQuoteUseCase {
  constructor(
    private quotesRepository: QuotesRepository,
    private establishmentScope: EstablishmentScopeService,
    private unitOfWork: UnitOfWork,
    private approvalAnalyzer: QuoteApprovalAnalyzer,
    private serviceResolver: QuoteServiceResolver,
    private converter: QuoteToAppointmentConverter,
  ) {}

  async execute(
    request: ApproveQuoteUseCaseRequest,
  ): Promise<ApproveQuoteUseCaseResponse> {
    const scope = await this.establishmentScope.resolve(request.actor);
    if (scope.isLeft()) return left(scope.value);

    const establishmentId = scope.value.establishment.id.toString();

    try {
      const approvalResult =
        await this.unitOfWork.execute<ApprovalDispatchResponse>(async () => {
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

          validateQuoteApprovalSchedule(
            request.startsAt,
            request.endsAt ?? null,
          );

          const analysis = await this.approvalAnalyzer.analyze({
            quote,
            establishmentId,
          });

          await this.serviceResolver.resolve({
            quote,
            establishmentId: quote.establishmentId,
            analysis,
            resolutions: [],
          });

          await this.quotesRepository.save(quote);

          const appointment = await this.converter.convert({
            quote,
            startsAt: request.startsAt,
            endsAt: request.endsAt ?? null,
          });

          const converted = await this.quotesRepository.markAsConverted(
            quote,
            appointment.id,
            new Date(),
          );

          if (!converted) {
            throw new InvalidQuoteInputError(
              "Quote is already converted.",
              "QUOTE_ALREADY_CONVERTED",
            );
          }

          return right({ appointment, quote });
        });

      if (approvalResult.isLeft()) return left(approvalResult.value);

      return right(approvalResult.value);
    } catch (error) {
      return left(this.toApprovalError(error));
    }
  }

  private toApprovalError(error: unknown) {
    if (
      error instanceof ResourceNotFoundError ||
      error instanceof NotAllowedError ||
      error instanceof InvalidQuoteInputError ||
      error instanceof UnexpectedDomainError
    ) {
      return error;
    }

    if (
      error instanceof QuoteApprovalResolutionRequiredError ||
      error instanceof QuoteInvalidResolutionActionError
    ) {
      return new InvalidQuoteInputError(error.message, error.code);
    }

    return new UnexpectedDomainError();
  }
}
