import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { Customer } from "../../../customer/domain/entities/customer";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { UnitOfWork } from "../../repositories/unit-of-work";

type DeleteCustomerUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
};

type DeleteCustomerUseCaseResponse = Either<
  Error,
  {
    customer: Customer;
  }
>;

@Injectable()
export class DeleteCustomerUseCase {
  constructor(
    private customersRepository: CustomersRepository,
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private establishmentsRepository: EstablishmentsRepository,
    private unitOfWork: UnitOfWork,
  ) {}

  async execute({
    establishmentOwnerId,
    customerId,
  }: DeleteCustomerUseCaseRequest): Promise<DeleteCustomerUseCaseResponse> {
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

    try {
      await this.unitOfWork.execute(async () => {
        const referenceDate = new Date();
        const vehicles =
          await this.customerVehiclesRepository.findManyByCustomerIdAndEstablishmentId(
            customer.id.toString(),
            establishment.id.toString(),
          );

        customer.softDelete(referenceDate);

        for (const vehicle of vehicles) {
          vehicle.softDelete(referenceDate);
          await this.customerVehiclesRepository.save(vehicle);
        }

        await this.customersRepository.save(customer);
      });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    return right({
      customer,
    });
  }
}
