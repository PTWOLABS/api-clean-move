import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type DeleteCustomerVehicleUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
  vehicleId: string;
};

type DeleteCustomerVehicleUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    vehicle: CustomerVehicle;
  }
>;

@Injectable()
export class DeleteCustomerVehicleUseCase {
  constructor(
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private customersRepository: CustomersRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    customerId,
    vehicleId,
  }: DeleteCustomerVehicleUseCaseRequest): Promise<DeleteCustomerVehicleUseCaseResponse> {
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

    const vehicle =
      await this.customerVehiclesRepository.findByIdAndCustomerIdAndEstablishmentId(
        vehicleId,
        customer.id.toString(),
        establishment.id.toString(),
      );

    if (!vehicle || vehicle.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "vehicle" }));
    }

    vehicle.softDelete();

    await this.customerVehiclesRepository.save(vehicle);

    return right({
      vehicle,
    });
  }
}
