import {
  EmployeeFilters,
  EmployeesRepository,
} from "../../src/modules/application/repositories/employees-repository";
import { Employee } from "../../src/modules/employees/domain/entities/employee";

export class InMemoryEmployeesRepository implements EmployeesRepository {
  public items: Employee[] = [];

  async create(employee: Employee): Promise<void> {
    this.items.push(employee);
  }

  async findById(id: string): Promise<Employee | null> {
    const employee = this.items.find((item) => item.id.toString() === id);

    return employee ?? null;
  }

  async findByUserId(userId: string): Promise<Employee | null> {
    const employee = this.items.find(
      (item) => item.userId.toString() === userId,
    );

    return employee ?? null;
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Employee | null> {
    const employee = this.items.find(
      (item) =>
        item.id.toString() === id &&
        item.establishmentId.toString() === establishmentId,
    );

    return employee ?? null;
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: EmployeeFilters,
  ): Promise<Employee[]> {
    const name = filters?.name?.trim().toLowerCase();

    return this.items
      .slice()
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime())
      .filter((item) => item.establishmentId.toString() === establishmentId)
      .filter((item) => filters?.includeDeleted || !item.isDeleted())
      .filter((item) => {
        if (!name) {
          return true;
        }

        return item.name.toLowerCase().includes(name);
      });
  }

  async save(employee: Employee): Promise<void> {
    const employeeIndex = this.items.findIndex((item) =>
      item.id.equals(employee.id),
    );

    if (employeeIndex === -1) {
      this.items.push(employee);
      return;
    }

    this.items[employeeIndex] = employee;
  }
}
