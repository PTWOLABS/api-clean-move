import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Customer } from "../../../customer/domain/entities/customer";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type ListCustomersUseCaseRequest = {
  establishmentOwnerId: string;
  search?: string;
  page?: number;
  size?: number;
};

export type CustomerListItem = {
  customer: Customer;
  vehicles: CustomerVehicle[];
};

type ListCustomersUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    customers: CustomerListItem[];
    totalItems: number;
  }
>;

@Injectable()
export class ListCustomersUseCase {
  constructor(
    private customersRepository: CustomersRepository,
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    search,
    page,
    size,
  }: ListCustomersUseCaseRequest): Promise<ListCustomersUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const establishmentId = establishment.id.toString();

    const { customers, totalItems } =
      await this.customersRepository.findManyByEstablishmentId(
        establishmentId,
        {
          ...(search !== undefined ? { search } : {}),
          ...(page !== undefined ? { page } : {}),
          ...(size !== undefined ? { size } : {}),
        },
      );

    const customerIds = customers.map((customer) => customer.id.toString());

    const vehicles =
      await this.customerVehiclesRepository.findAllActiveByCustomerIdsAndEstablishmentId(
        customerIds,
        establishmentId,
      );

    const vehiclesByCustomerId = new Map<string, CustomerVehicle[]>();

    for (const vehicle of vehicles) {
      const customerId = vehicle.customerId.toString();
      const customerVehicles = vehiclesByCustomerId.get(customerId) ?? [];

      customerVehicles.push(vehicle);
      vehiclesByCustomerId.set(customerId, customerVehicles);
    }

    return right({
      customers: customers.map((customer) => ({
        customer,
        vehicles: vehiclesByCustomerId.get(customer.id.toString()) ?? [],
      })),
      totalItems,
    });
  }
}
