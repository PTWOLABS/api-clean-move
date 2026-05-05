import { Injectable } from "@nestjs/common";
import { Employee } from "../../employees/domain/entities/employee";

@Injectable()
export abstract class EmployeesRepository {
  abstract create(employee: Employee): Promise<void>;
  abstract findByUserId(userId: string): Promise<Employee | null>;
}
