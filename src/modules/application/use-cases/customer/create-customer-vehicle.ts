import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type CreateCustomerVehicleUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  notes?: string | null;
};

type CreateCustomerVehicleUseCaseResponse = Either<
  Error,
  {
    vehicle: CustomerVehicle;
  }
>;

@Injectable()
export class CreateCustomerVehicleUseCase {
  constructor(
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private customersRepository: CustomersRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    customerId,
    plate = null,
    brand = null,
    model = null,
    color = null,
    year = null,
    notes = null,
  }: CreateCustomerVehicleUseCaseRequest): Promise<CreateCustomerVehicleUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const customer =
      await this.customersRepository.findByIdAndEstablishmentId(
        customerId,
        establishment.id.toString(),
      );

    if (!customer || customer.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "customer" }));
    }

    let vehicle: CustomerVehicle;

    try {
      vehicle = CustomerVehicle.create({
        establishmentId: establishment.id,
        customerId: customer.id,
        plate,
        brand,
        model,
        color,
        year,
        notes,
      });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    if (vehicle.plate) {
      const vehicleWithSamePlate =
        await this.customerVehiclesRepository.findActiveByPlateAndEstablishmentId(
          vehicle.plate,
          establishment.id.toString(),
        );

      if (vehicleWithSamePlate) {
        return left(
          new ResourceAlreadyExistsError("Vehicle already registered."),
        );
      }
    }

    await this.customerVehiclesRepository.create(vehicle);

    return right({
      vehicle,
    });
  }
}
