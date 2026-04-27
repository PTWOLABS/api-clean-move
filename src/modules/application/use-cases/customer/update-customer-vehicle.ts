import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type UpdateCustomerVehicleUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
  vehicleId: string;
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  notes?: string | null;
};

type UpdateCustomerVehicleUseCaseResponse = Either<
  Error,
  {
    vehicle: CustomerVehicle;
  }
>;

@Injectable()
export class UpdateCustomerVehicleUseCase {
  constructor(
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private customersRepository: CustomersRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    customerId,
    vehicleId,
    plate,
    brand,
    model,
    color,
    year,
    notes,
  }: UpdateCustomerVehicleUseCaseRequest): Promise<UpdateCustomerVehicleUseCaseResponse> {
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

    const vehicle =
      await this.customerVehiclesRepository.findByIdAndCustomerIdAndEstablishmentId(
        vehicleId,
        customer.id.toString(),
        establishment.id.toString(),
      );

    if (!vehicle || vehicle.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "vehicle" }));
    }

    if (plate !== undefined) {
      let normalizedPlate: string | null;

      try {
        normalizedPlate = CustomerVehicle.create({
          establishmentId: establishment.id,
          customerId: customer.id,
          plate,
          brand: null,
          model: null,
          color: null,
          year: null,
          notes: null,
        }).plate;
      } catch (error) {
        return left(
          error instanceof Error ? error : new UnexpectedDomainError(),
        );
      }

      if (normalizedPlate) {
        const vehicleWithSamePlate =
          await this.customerVehiclesRepository.findActiveByPlateAndEstablishmentId(
            normalizedPlate,
            establishment.id.toString(),
          );

        if (
          vehicleWithSamePlate &&
          !vehicleWithSamePlate.id.equals(vehicle.id)
        ) {
          return left(
            new ResourceAlreadyExistsError("Vehicle already registered."),
          );
        }
      }
    }

    try {
      vehicle.update({
        ...(plate !== undefined ? { plate } : {}),
        ...(brand !== undefined ? { brand } : {}),
        ...(model !== undefined ? { model } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(year !== undefined ? { year } : {}),
        ...(notes !== undefined ? { notes } : {}),
      });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    await this.customerVehiclesRepository.save(vehicle);

    return right({
      vehicle,
    });
  }
}
