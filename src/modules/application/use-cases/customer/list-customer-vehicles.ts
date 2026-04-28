import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type ListCustomerVehiclesUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
  page?: number;
  size?: number;
};

type ListCustomerVehiclesUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    vehicles: CustomerVehicle[];
  }
>;

@Injectable()
export class ListCustomerVehiclesUseCase {
  constructor(
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private customersRepository: CustomersRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    customerId,
    page,
    size,
  }: ListCustomerVehiclesUseCaseRequest): Promise<ListCustomerVehiclesUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const customer = await this.customersRepository.findByIdAndEstablishmentId(
      customerId,
      establishment.id.toString(),
    );

    if (!customer || customer.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "customer" }));
    }

    const vehicles =
      await this.customerVehiclesRepository.findManyByCustomerIdAndEstablishmentId(
        customer.id.toString(),
        establishment.id.toString(),
        {
          ...(page !== undefined ? { page } : {}),
          ...(size !== undefined ? { size } : {}),
        },
      );

    return right({
      vehicles,
    });
  }
}
