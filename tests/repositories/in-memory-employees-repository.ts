import { EmployeesRepository } from "../../src/modules/application/repositories/employees-repository";
import { Employee } from "../../src/modules/employees/domain/entities/employee";

export class InMemoryEmployeesRepository implements EmployeesRepository {
  public items: Employee[] = [];

  async create(employee: Employee): Promise<void> {
    this.items.push(employee);
  }

  async findByUserId(userId: string): Promise<Employee | null> {
    const employee = this.items.find((item) => item.userId.toString() === userId);

    return employee ?? null;
  }
}
