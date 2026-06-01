import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { ResolvedDashboardMetricsRange } from "../../services/dashboard-metrics-range-resolver";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type GetEstablishmentTopCustomersUseCaseRequest = {
  establishmentOwnerId: string;
  range: ResolvedDashboardMetricsRange;
  pagination?: {
    page: number;
    size: number;
  };
};

type TopCustomerItem = {
  position: number;
  customerId: string;
  customerName: string;
  completedAppointmentsCount: number;
  totalSpentInCents: number;
};

type GetEstablishmentTopCustomersUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    customers: TopCustomerItem[];
    totalCustomers: number;
  }
>;

@Injectable()
export class GetEstablishmentTopCustomersUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    range,
    pagination,
  }: GetEstablishmentTopCustomersUseCaseRequest): Promise<GetEstablishmentTopCustomersUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const page = pagination?.page ?? 1;
    const size = pagination?.size ?? 5;
    const { items, totalCustomers } =
      await this.appointmentsRepository.findTopCustomersByEstablishmentId(
        establishment.id.toString(),
        {
          startsAt: range.current.startsAt,
          endsAt: range.current.endsAt,
          page,
          size,
        },
      );
    const positionOffset = (page - 1) * size;

    return right({
      customers: items.map((customer, index) => ({
        position: positionOffset + index + 1,
        customerId: customer.customerId,
        customerName: customer.customerName,
        completedAppointmentsCount: customer.completedAppointmentsCount,
        totalSpentInCents: customer.totalSpentInCents,
      })),
      totalCustomers,
    });
  }
}
