import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import {
  CustomerVehicleOption,
  CustomerVehiclesRepository,
} from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";

type ListCustomerVehicleOptionsUseCaseRequest = {
  actor: EstablishmentScopeActor;
  search?: string;
  customerId?: string;
  limit?: number;
};

type ListCustomerVehicleOptionsUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    vehicles: CustomerVehicleOption[];
  }
>;

@Injectable()
export class ListCustomerVehicleOptionsUseCase {
  constructor(
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private customersRepository: CustomersRepository,
    private establishmentScope: EstablishmentScopeService,
  ) {}

  async execute({
    actor,
    search,
    customerId,
    limit,
  }: ListCustomerVehicleOptionsUseCaseRequest): Promise<ListCustomerVehicleOptionsUseCaseResponse> {
    const scopeResult = await this.establishmentScope.resolve(actor);

    if (scopeResult.isLeft()) {
      return left(scopeResult.value);
    }

    const { establishment } = scopeResult.value;
    const establishmentId = establishment.id.toString();

    if (customerId !== undefined) {
      const customer =
        await this.customersRepository.findByIdAndEstablishmentId(
          customerId,
          establishmentId,
        );

      if (!customer || customer.isDeleted()) {
        return left(new ResourceNotFoundError({ resource: "customer" }));
      }
    }

    const vehicles =
      await this.customerVehiclesRepository.findOptionsByEstablishmentId(
        establishmentId,
        {
          ...(search !== undefined ? { search } : {}),
          ...(customerId !== undefined ? { customerId } : {}),
          ...(limit !== undefined ? { limit } : {}),
        },
      );

    return right({
      vehicles,
    });
  }
}
