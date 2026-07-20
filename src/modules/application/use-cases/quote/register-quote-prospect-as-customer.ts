import { Injectable } from "@nestjs/common";

import { Customer } from "../../../customer/domain/entities/customer";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
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
  QuoteApprovalAnalysis,
  QuoteCustomerAnalysis,
  QuoteCustomerResolution,
  QuoteVehicleAnalysis,
  QuoteVehicleResolution,
} from "../../services/quote-approval/quote-approval-analysis";
import {
  QuoteApprovalResolutionRequiredError,
  QuoteInvalidResolutionActionError,
} from "../../services/quote-approval/quote-approval-resolution-error";
import { QuoteCustomerMatcher } from "../../services/quote-approval/quote-customer-matcher";
import { QuoteCustomerResolver } from "../../services/quote-approval/quote-customer-resolver";
import { QuoteVehicleMatcher } from "../../services/quote-approval/quote-vehicle-matcher";

export type RegisterQuoteProspectAsCustomerUseCaseRequest = {
  actor: EstablishmentScopeActor;
  quoteId: string;
  email: string;
  phone?: string | null;
  createVehicleFromQuote: boolean;
  customerResolution?: QuoteCustomerResolution;
  vehicleResolution?: QuoteVehicleResolution;
};

type RegisterQuoteProspectAsCustomerUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InvalidQuoteInputError
  | QuoteApprovalResolutionRequiredError
  | QuoteInvalidResolutionActionError
  | UnexpectedDomainError
  | Error,
  {
    customer: Customer;
    vehicle: CustomerVehicle | null;
    quote: Quote;
  }
>;

@Injectable()
export class RegisterQuoteProspectAsCustomerUseCase {
  constructor(
    private quotesRepository: QuotesRepository,
    private establishmentScope: EstablishmentScopeService,
    private unitOfWork: UnitOfWork,
    private customerMatcher: QuoteCustomerMatcher,
    private vehicleMatcher: QuoteVehicleMatcher,
    private customerResolver: QuoteCustomerResolver,
  ) {}

  async execute(
    request: RegisterQuoteProspectAsCustomerUseCaseRequest,
  ): Promise<RegisterQuoteProspectAsCustomerUseCaseResponse> {
    const scope = await this.establishmentScope.resolve(request.actor);
    if (scope.isLeft()) return left(scope.value);

    const quote = await this.quotesRepository.findByIdAndEstablishmentId(
      request.quoteId,
      scope.value.establishment.id.toString(),
    );

    if (!quote) {
      return left(new ResourceNotFoundError({ resource: "quote" }));
    }

    if (quote.customerId) {
      return left(
        new InvalidQuoteInputError(
          "Quote already has a customer.",
          "QUOTE_ALREADY_HAS_CUSTOMER",
        ),
      );
    }

    try {
      const result = await this.unitOfWork.execute(async () => {
        const customerAnalysis = await this.customerMatcher.analyze({
          quote,
          establishmentId: scope.value.establishment.id.toString(),
        });

        const customerResolution = resolveCustomerDecision(
          customerAnalysis,
          request,
        );
        const vehicleAnalysis = await this.vehicleMatcher.analyze({
          quote,
          establishmentId: scope.value.establishment.id.toString(),
          resolvedCustomerId: getResolvedCustomerId(
            customerAnalysis,
            customerResolution,
          ),
        });
        const vehicleResolution = resolveVehicleDecision(
          vehicleAnalysis,
          quote,
          request,
        );
        const analysis = toApprovalAnalysis(customerAnalysis, vehicleAnalysis);
        const resolved = await this.customerResolver.resolve({
          quote,
          establishmentId: quote.establishmentId,
          analysis,
          ...(customerResolution ? { customerResolution } : {}),
          ...(vehicleResolution ? { vehicleResolution } : {}),
        });

        await this.quotesRepository.save(quote);

        return resolved;
      });

      return right({ ...result, quote });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }
  }
}

function resolveCustomerDecision(
  analysis: QuoteCustomerAnalysis,
  request: RegisterQuoteProspectAsCustomerUseCaseRequest,
): QuoteCustomerResolution | undefined {
  if (request.customerResolution) {
    return request.customerResolution;
  }

  if (shouldCreateCustomerByDefault(analysis)) {
    return {
      action: "CREATE_NEW",
      email: request.email,
      ...(request.phone !== undefined ? { phone: request.phone } : {}),
    };
  }

  return undefined;
}

function shouldCreateCustomerByDefault(analysis: QuoteCustomerAnalysis) {
  if (analysis.status === "CREATE_REQUIRED") {
    return true;
  }

  if (analysis.status === "CANDIDATES_FOUND") {
    return analysis.candidates.every((candidate) => candidate.advisoryOnly);
  }

  return false;
}

function resolveVehicleDecision(
  analysis: QuoteVehicleAnalysis,
  quote: Quote,
  request: RegisterQuoteProspectAsCustomerUseCaseRequest,
): QuoteVehicleResolution | undefined {
  if (request.vehicleResolution) {
    return request.vehicleResolution;
  }

  if (request.createVehicleFromQuote) {
    if (!quote.vehicle) {
      throw new InvalidQuoteInputError(
        "Quote has no vehicle snapshot.",
        "QUOTE_VEHICLE_SNAPSHOT_MISSING",
      );
    }

    return { action: "CREATE_FROM_SNAPSHOT" };
  }

  if (!quote.vehicle || analysis.status === "NONE") {
    return undefined;
  }

  return { action: "KEEP_SNAPSHOT_ONLY" };
}

function getResolvedCustomerId(
  analysis: QuoteCustomerAnalysis,
  resolution?: QuoteCustomerResolution,
) {
  if (analysis.automaticCustomerId) {
    return analysis.automaticCustomerId;
  }

  if (resolution?.action === "LINK_EXISTING") {
    return resolution.customerId;
  }

  return null;
}

function toApprovalAnalysis(
  customer: QuoteCustomerAnalysis,
  vehicle: QuoteVehicleAnalysis,
): QuoteApprovalAnalysis {
  const requiresResolution =
    customer.requiresResolution || vehicle.requiresResolution;

  return {
    status: requiresResolution ? "REQUIRES_RESOLUTION" : "READY",
    automaticResolutions:
      customer.status === "AUTO_LINK" && customer.automaticCustomerId
        ? [
            {
              resource: "CUSTOMER",
              action: "LINK_EXISTING",
              resourceId: customer.automaticCustomerId,
              matchedBy: "CPF_CNPJ",
            },
          ]
        : [],
    customer,
    vehicle,
    services: [],
  };
}
