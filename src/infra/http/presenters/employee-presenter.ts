import { Employee } from "../../../modules/employees/domain/entities/employee";

export class EmployeePresenter {
  static toHTTP(employee: Employee) {
    return {
      id: employee.id.toString(),
      establishmentId: employee.establishmentId.toString(),
      userId: employee.userId.toString(),
      profileImageUrl: employee.profileImageUrl,
      name: employee.name,
      cpf: employee.cpf?.toString() ?? null,
      birthDate: employee.birthDate?.toString() ?? null,
      features: employee.features,
      createdAt: employee.createdAt?.toISOString() ?? null,
      updatedAt: employee.updatedAt?.toISOString() ?? null,
    };
  }
}
