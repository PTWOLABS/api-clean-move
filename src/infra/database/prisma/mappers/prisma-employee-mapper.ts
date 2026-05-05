import {
  Employee as PrismaEmployee,
  Prisma,
} from "../../../../generated/prisma/client";
import { Cpf } from "../../../../modules/accounts/domain/value-objects/cpf";
import { Employee } from "../../../../modules/employees/domain/entities/employee";
import { EmployeeFeaturesPolicy } from "../../../../modules/employees/domain/policies/employee-features-policy";
import { BirthDate } from "../../../../modules/employees/domain/value-objects/birth-date";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export class PrismaEmployeeMapper {
  static toDomain(raw: PrismaEmployee): Employee {
    return Employee.restore(
      {
        establishmentId: new UniqueEntityId(raw.establishmentId),
        userId: new UniqueEntityId(raw.userId),
        profileImageUrl: raw.profileImageUrl,
        name: raw.name ?? "",
        cpf: raw.cpf ? Cpf.create(raw.cpf) : null,
        birthDate: raw.birthDate
          ? BirthDate.create(raw.birthDate, { mustBeAdult: false })
          : null,
        features: EmployeeFeaturesPolicy.normalizePersisted(raw.features),
        deletedAt: null,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(raw: Employee): Prisma.EmployeeUncheckedCreateInput {
    return {
      id: raw.id.toString(),
      establishmentId: raw.establishmentId.toString(),
      userId: raw.userId.toString(),
      profileImageUrl: raw.profileImageUrl,
      name: raw.name,
      cpf: raw.cpf?.toString() ?? null,
      birthDate: raw.birthDate?.toDate() ?? null,
      features: raw.features,
      ...(raw.createdAt ? { createdAt: raw.createdAt } : {}),
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }
}
