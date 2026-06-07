import { Employee } from "../../../modules/employees/domain/entities/employee";

type EmployeePresenterOptions = {
  profileImageUrl?: string | null;
};

export class EmployeePresenter {
  static toHTTP(employee: Employee, options?: EmployeePresenterOptions) {
    return {
      id: employee.id.toString(),
      establishmentId: employee.establishmentId.toString(),
      userId: employee.userId.toString(),
      profileImageUrl: options?.profileImageUrl ?? null,
      name: employee.name,
      cpf: employee.cpf?.toString() ?? null,
      birthDate: employee.birthDate?.toString() ?? null,
      features: employee.features,
      deletedAt: employee.deletedAt?.toISOString() ?? null,
      createdAt: employee.createdAt?.toISOString() ?? null,
      updatedAt: employee.updatedAt?.toISOString() ?? null,
    };
  }
}
