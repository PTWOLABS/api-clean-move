import { PrismaEmployeeMapper } from "../../src/infra/database/prisma/mappers/prisma-employee-mapper";
import { PrismaService } from "../../src/infra/database/prisma/prisma.service";
import {
  Employee,
  EmployeeCreateProps,
} from "../../src/modules/employees/domain/entities/employee";
import { UniqueEntityId } from "../../src/shared/entities/unique-entity-id";
import { makeFullName } from "./random-data";

export function makeEmployee(
  override?: Partial<EmployeeCreateProps>,
  id?: UniqueEntityId,
) {
  return Employee.create(
    {
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: makeFullName(),
      ...override,
    },
    id,
  );
}

export class EmployeeFactory {
  constructor(private prisma: PrismaService) {}

  async makePrismaEmployee(
    data?: Partial<EmployeeCreateProps>,
    id?: UniqueEntityId,
  ) {
    const employee = makeEmployee(data, id);

    await this.prisma.employee.create({
      data: PrismaEmployeeMapper.toPrisma(employee),
    });

    return employee;
  }
}
