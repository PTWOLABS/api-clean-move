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
  QuoteApprovalConflictsChangedError,
  QuoteInvalidResolutionActionError,
} from "../../services/quote-approval/quote-approval-resolution-error";
import { validateQuoteApprovalResolutions } from "../../services/quote-approval/quote-approval-resolution-validation";
import { validateQuoteApprovalSchedule } from "../../services/quote-approval/quote-approval-schedule";
import { QuoteApprovalAnalyzer } from "../../services/quote-approval/quote-approval-analyzer";
import { QuoteCustomerResolver } from "../../services/quote-approval/quote-customer-resolver";
import { QuoteServiceResolver } from "../../services/quote-approval/quote-service-resolver";
import { QuoteToAppointmentConverter } from "../../services/quote-approval/quote-to-appointment-converter";
import {
  QuoteApprovalAnalysis,
  QuoteCustomerResolution,
  QuoteServiceResolution,
  QuoteVehicleResolution,
} from "../../services/quote-approval/quote-approval-analysis";
import { UniqueConstraintViolationError } from "../../../../shared/errors/unique-constraint-violation-error";

export type ApproveQuoteUseCaseRequest = {
  actor: EstablishmentScopeActor;
  quoteId: string;
  startsAt: Date;
  endsAt?: Date | null;
  customerResolution?: QuoteCustomerResolution;
  vehicleResolution?: QuoteVehicleResolution;
  serviceResolutions?: QuoteServiceResolution[];
};

type ApproveQuoteUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InvalidQuoteInputError
  | QuoteApprovalResolutionRequiredError
  | QuoteApprovalConflictsChangedError
  | QuoteInvalidResolutionActionError
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
    private customerResolver: QuoteCustomerResolver,
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

          validateQuoteApprovalResolutions(analysis, request);
          assertCurrentResolutionTargets(analysis, request);

          await this.customerResolver.resolve({
            quote,
            establishmentId: quote.establishmentId,
            analysis,
            ...(request.customerResolution
              ? { customerResolution: request.customerResolution }
              : {}),
            ...(request.vehicleResolution
              ? { vehicleResolution: request.vehicleResolution }
              : {}),
          });

          await this.serviceResolver.resolve({
            quote,
            establishmentId: quote.establishmentId,
            analysis,
            resolutions: request.serviceResolutions ?? [],
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
      if (error instanceof UniqueConstraintViolationError) {
        return left(
          await this.toChangedConflictError({
            quoteId: request.quoteId,
            establishmentId,
          }),
        );
      }

      return left(this.toApprovalError(error));
    }
  }

  private async toChangedConflictError(input: {
    quoteId: string;
    establishmentId: string;
  }) {
    const quote = await this.quotesRepository.findByIdAndEstablishmentId(
      input.quoteId,
      input.establishmentId,
    );

    if (!quote) {
      return new UnexpectedDomainError();
    }

    const analysis = await this.approvalAnalyzer.analyze({
      quote,
      establishmentId: input.establishmentId,
    });

    return new QuoteApprovalConflictsChangedError(analysis);
  }

  private toApprovalError(error: unknown) {
    if (
      error instanceof ResourceNotFoundError ||
      error instanceof NotAllowedError ||
      error instanceof InvalidQuoteInputError ||
      error instanceof QuoteApprovalResolutionRequiredError ||
      error instanceof QuoteApprovalConflictsChangedError ||
      error instanceof QuoteInvalidResolutionActionError ||
      error instanceof UnexpectedDomainError
    ) {
      return error;
    }

    return new UnexpectedDomainError();
  }
}

function assertCurrentResolutionTargets(
  analysis: QuoteApprovalAnalysis,
  request: ApproveQuoteUseCaseRequest,
): void {
  const customerResolution = request.customerResolution;

  if (
    customerResolution?.action === "LINK_EXISTING" &&
    analysis.customer.candidates.length > 0 &&
    !analysis.customer.candidates.some(
      (candidate) => candidate.customerId === customerResolution.customerId,
    )
  ) {
    throw new QuoteApprovalConflictsChangedError(analysis);
  }

  if (
    request.vehicleResolution?.action === "LINK_EXISTING" &&
    analysis.vehicle.candidateVehicleId &&
    analysis.vehicle.candidateVehicleId !== request.vehicleResolution.vehicleId
  ) {
    throw new QuoteApprovalConflictsChangedError(analysis);
  }

  const servicesById = new Map(
    analysis.services.map((service) => [service.quoteServiceId, service]),
  );

  for (const resolution of request.serviceResolutions ?? []) {
    const item = servicesById.get(resolution.quoteServiceId);

    if (
      resolution.action === "ASSOCIATE_EXISTING" &&
      item?.candidateServiceId &&
      item.candidateServiceId !== resolution.serviceId
    ) {
      throw new QuoteApprovalConflictsChangedError(analysis);
    }
  }
}
