import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type GetCustomerVehicleUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
  vehicleId: string;
};

type GetCustomerVehicleUseCaseResponse = Either<
  ResourceNotFoundError,
  { vehicle: CustomerVehicle }
>;

@Injectable()
export class GetCustomerVehicleUseCase {
  constructor(
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private customersRepository: CustomersRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    customerId,
    vehicleId,
  }: GetCustomerVehicleUseCaseRequest): Promise<GetCustomerVehicleUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const establishmentId = establishment.id.toString();

    const customer = await this.customersRepository.findByIdAndEstablishmentId(
      customerId,
      establishmentId,
    );

    if (!customer || customer.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "customer" }));
    }

    const vehicle =
      await this.customerVehiclesRepository.findByIdAndCustomerIdAndEstablishmentId(
        vehicleId,
        customer.id.toString(),
        establishmentId,
      );

    if (!vehicle || vehicle.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "vehicle" }));
    }

    return right({ vehicle });
  }
}
