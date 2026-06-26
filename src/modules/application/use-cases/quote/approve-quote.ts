import { Injectable } from "@nestjs/common";

import { Appointment } from "../../../scheduling/domain/entities/appointment";
import { Quote } from "../../../quotes/domain/entities/quote";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { QuotesRepository } from "../../repositories/quotes-repository";
import { UnitOfWork } from "../../repositories/unit-of-work";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";

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
  Record<string, never>
>;

@Injectable()
export class ApproveQuoteUseCase {
  constructor(
    private quotesRepository: QuotesRepository,
    private appointmentsRepository: AppointmentsRepository,
    private establishmentScope: EstablishmentScopeService,
    private unitOfWork: UnitOfWork,
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

          quote.approve({
            startsAt: request.startsAt,
            endsAt: request.endsAt ?? null,
          });

          return right({});
        });

      if (approvalResult.isLeft()) return left(approvalResult.value);
    } catch (error) {
      return left(this.toApprovalError(error));
    }

    const quote = await this.quotesRepository.findByIdAndEstablishmentId(
      request.quoteId,
      establishmentId,
    );

    if (!quote?.convertedAppointmentId) {
      return left(new UnexpectedDomainError());
    }

    const appointment = await this.appointmentsRepository.findById(
      quote.convertedAppointmentId.toString(),
    );

    if (!appointment) {
      return left(new UnexpectedDomainError());
    }

    return right({ appointment, quote });
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

    return new UnexpectedDomainError();
  }
}
