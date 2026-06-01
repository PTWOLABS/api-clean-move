import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type ListVehiclesUseCaseRequest = {
  establishmentOwnerId: string;
  customerId?: string;
  customerName?: string;
  page?: number;
  size?: number;
};

type ListVehiclesUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    vehicles: CustomerVehicle[];
    totalItems: number;
  }
>;

@Injectable()
export class ListVehiclesUseCase {
  constructor(
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private customersRepository: CustomersRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    customerId,
    customerName,
    page,
    size,
  }: ListVehiclesUseCaseRequest): Promise<ListVehiclesUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

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

    const { vehicles, totalItems } =
      await this.customerVehiclesRepository.findManyByEstablishmentId(
        establishmentId,
        {
          ...(customerId !== undefined ? { customerId } : {}),
          ...(customerName !== undefined ? { customerName } : {}),
          ...(page !== undefined ? { page } : {}),
          ...(size !== undefined ? { size } : {}),
        },
      );

    return right({
      vehicles,
      totalItems,
    });
  }
}
