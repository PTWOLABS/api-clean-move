import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Employee } from "../../../employees/domain/entities/employee";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type ListEmployeesUseCaseRequest = {
  establishmentOwnerId: string;
  name?: string;
};

type ListEmployeesUseCaseResponse = Either<
  ResourceNotFoundError,
  { employees: Employee[] }
>;

@Injectable()
export class ListEmployeesUseCase {
  constructor(
    private employeesRepository: EmployeesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    name,
  }: ListEmployeesUseCaseRequest): Promise<ListEmployeesUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const employees = await this.employeesRepository.findManyByEstablishmentId(
      establishment.id.toString(),
      {
        ...(name !== undefined ? { name } : {}),
      },
    );

    return right({ employees });
  }
}
