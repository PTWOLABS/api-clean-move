import { Injectable } from "@nestjs/common";
import { Employee } from "../../employees/domain/entities/employee";

export type EmployeeFilters = {
  name?: string;
  includeDeleted?: boolean;
};

@Injectable()
export abstract class EmployeesRepository {
  abstract create(employee: Employee): Promise<void>;
  abstract findById(id: string): Promise<Employee | null>;
  abstract findByUserId(userId: string): Promise<Employee | null>;
  abstract findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Employee | null>;
  abstract findManyByEstablishmentId(
    establishmentId: string,
    filters?: EmployeeFilters,
  ): Promise<Employee[]>;
  abstract save(employee: Employee): Promise<void>;
}
