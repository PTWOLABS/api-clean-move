import { Injectable } from "@nestjs/common";

import { Customer } from "../../../customer/domain/entities/customer";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import { Quote } from "../../../quotes/domain/entities/quote";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import {
  QuoteApprovalAnalysis,
  QuoteCustomerResolution,
  QuoteVehicleResolution,
} from "./quote-approval-analysis";
import {
  QuoteApprovalResolutionRequiredError,
  QuoteInvalidResolutionActionError,
} from "./quote-approval-resolution-error";
import { validateQuoteApprovalResolutions } from "./quote-approval-resolution-validation";
import {
  createCustomerFromQuoteSnapshot,
  createVehicleFromQuoteSnapshot,
} from "./quote-resource-snapshot-factory";

type QuoteCustomerResolverInput = {
  quote: Quote;
  establishmentId: UniqueEntityId;
  analysis: QuoteApprovalAnalysis;
  customerResolution?: QuoteCustomerResolution;
  vehicleResolution?: QuoteVehicleResolution;
};

@Injectable()
export class QuoteCustomerResolver {
  constructor(
    private readonly customersRepository: CustomersRepository,
    private readonly customerVehiclesRepository: CustomerVehiclesRepository,
  ) {}

  async resolve({
    quote,
    establishmentId,
    analysis,
    customerResolution,
    vehicleResolution,
  }: QuoteCustomerResolverInput): Promise<{
    customer: Customer;
    vehicle: CustomerVehicle | null;
  }> {
    validateQuoteApprovalResolutions(analysis, {
      ...(customerResolution ? { customerResolution } : {}),
      ...(vehicleResolution ? { vehicleResolution } : {}),
      serviceResolutions: [],
    });

    const customer = await this.resolveCustomer({
      quote,
      establishmentId,
      analysis,
      ...(customerResolution ? { customerResolution } : {}),
    });
    const vehicle = await this.resolveVehicle({
      quote,
      establishmentId,
      customer,
      analysis,
      ...(vehicleResolution ? { vehicleResolution } : {}),
    });

    quote.resolveCustomerReferences(customer.id, vehicle?.id ?? null);

    return { customer, vehicle };
  }

  private async resolveCustomer(input: {
    quote: Quote;
    establishmentId: UniqueEntityId;
    analysis: QuoteApprovalAnalysis;
    customerResolution?: QuoteCustomerResolution;
  }): Promise<Customer> {
    const establishmentId = input.establishmentId.toString();
    const automaticCustomerId = input.analysis.customer.automaticCustomerId;

    if (automaticCustomerId) {
      return this.findActiveCustomer(automaticCustomerId, establishmentId);
    }

    if (
      input.analysis.customer.status === "RESOLVED" &&
      input.quote.customerId
    ) {
      return this.findActiveCustomer(
        input.quote.customerId.toString(),
        establishmentId,
      );
    }

    if (!input.customerResolution) {
      throw new QuoteApprovalResolutionRequiredError(input.analysis);
    }

    if (input.customerResolution.action === "LINK_EXISTING") {
      return this.findActiveCustomer(
        input.customerResolution.customerId,
        establishmentId,
      );
    }

    return this.createCustomerFromQuote({
      quote: input.quote,
      establishmentId: input.establishmentId,
      customerResolution: input.customerResolution,
    });
  }

  private async findActiveCustomer(
    customerId: string,
    establishmentId: string,
  ) {
    const customer =
      await this.customersRepository.findByIdAndEstablishmentIdIncludingDeleted(
        customerId,
        establishmentId,
      );

    if (!customer || customer.isDeleted()) {
      throw new QuoteInvalidResolutionActionError(
        "Customer resolution target was not found.",
      );
    }

    return customer;
  }

  private async createCustomerFromQuote(input: {
    quote: Quote;
    establishmentId: UniqueEntityId;
    customerResolution: Extract<
      QuoteCustomerResolution,
      { action: "CREATE_NEW" }
    >;
  }) {
    const cpfCnpj = input.quote.customer.cpfCnpj;

    if (cpfCnpj) {
      const conflict =
        await this.customersRepository.findActiveByCpfCnpjAndEstablishmentId(
          cpfCnpj,
          input.establishmentId.toString(),
        );

      if (conflict) {
        throw new QuoteInvalidResolutionActionError(
          "Customer document is already registered.",
        );
      }
    }

    const customer = createCustomerFromQuoteSnapshot({
      quote: input.quote,
      establishmentId: input.establishmentId,
      registration: input.customerResolution,
    });

    await this.customersRepository.create(customer);

    return customer;
  }

  private async resolveVehicle(input: {
    quote: Quote;
    establishmentId: UniqueEntityId;
    customer: Customer;
    analysis: QuoteApprovalAnalysis;
    vehicleResolution?: QuoteVehicleResolution;
  }): Promise<CustomerVehicle | null> {
    if (!input.quote.vehicle) {
      return null;
    }

    if (!input.vehicleResolution) {
      if (
        input.analysis.vehicle.status === "RESOLVED" &&
        input.quote.vehicleId
      ) {
        return this.findActiveVehicleForCustomer({
          vehicleId: input.quote.vehicleId.toString(),
          customerId: input.customer.id.toString(),
          establishmentId: input.establishmentId.toString(),
        });
      }

      if (!input.analysis.vehicle.requiresResolution) {
        return null;
      }

      throw new QuoteApprovalResolutionRequiredError(input.analysis);
    }

    if (input.vehicleResolution.action === "KEEP_SNAPSHOT_ONLY") {
      return null;
    }

    if (input.vehicleResolution.action === "LINK_EXISTING") {
      return this.findActiveVehicleForCustomer({
        vehicleId: input.vehicleResolution.vehicleId,
        customerId: input.customer.id.toString(),
        establishmentId: input.establishmentId.toString(),
      });
    }

    return this.createVehicleFromQuote(input);
  }

  private async findActiveVehicleForCustomer(input: {
    vehicleId: string;
    customerId: string;
    establishmentId: string;
  }) {
    const vehicle =
      await this.customerVehiclesRepository.findByIdAndEstablishmentIdIncludingDeleted(
        input.vehicleId,
        input.establishmentId,
      );

    if (
      !vehicle ||
      vehicle.isDeleted() ||
      vehicle.customerId.toString() !== input.customerId
    ) {
      throw new QuoteInvalidResolutionActionError(
        "Vehicle resolution target was not found.",
      );
    }

    return vehicle;
  }

  private async createVehicleFromQuote(input: {
    quote: Quote;
    establishmentId: UniqueEntityId;
    customer: Customer;
  }) {
    const vehicle = createVehicleFromQuoteSnapshot({
      quote: input.quote,
      establishmentId: input.establishmentId,
      customerId: input.customer.id,
    });

    await this.customerVehiclesRepository.create(vehicle);

    return vehicle;
  }
}
