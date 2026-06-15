import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { GetEstablishmentTopCustomersUseCase } from "../../../modules/application/use-cases/establishment/get-establishment-top-customers";
import {
  DashboardMetricsRangeQuery,
  InvalidDashboardMetricsRangeError,
  ResolvedDashboardMetricsRange,
  resolveDashboardMetricsRange,
} from "../../../modules/application/services/dashboard-metrics-range-resolver";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { DashboardMetricsTopCustomersResponseDto } from "../docs/domain-swagger.dto";
import { DashboardMetricsPresenter } from "../presenters/dashboard-metrics-presenter";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import {
  ApiDashboardMetricsErrors,
  ApiDashboardTopCustomersFilterQueries,
  ApiDashboardTopCustomersPaginationQueries,
  DashboardTopCustomersMetricsQuerySchema,
  dashboardTopCustomersMetricsQuerySchema,
  unwrapDashboardMetricsResult,
} from "./dashboard-metrics-http";

@ApiTags("dashboard metrics")
@ApiBearerAuth("access-token")
@Controller("/dashboard/metrics")
@Roles(["ESTABLISHMENT"])
export class DashboardMetricsTopCustomersController {
  constructor(
    private readonly getTopCustomers: GetEstablishmentTopCustomersUseCase,
  ) {}

  @Get("top-customers")
  @ApiOperation({
    summary: "Get top customers dashboard ranking.",
    description:
      "Returns customers ranked by DONE appointment visits and total net spent for the authenticated establishment.",
  })
  @ApiDashboardTopCustomersFilterQueries()
  @ApiDashboardTopCustomersPaginationQueries()
  @ApiOkResponse({
    description: "Top customers metrics returned successfully.",
    type: DashboardMetricsTopCustomersResponseDto,
  })
  @ApiDashboardMetricsErrors()
  async topCustomers(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dashboardTopCustomersMetricsQuerySchema))
    query: DashboardTopCustomersMetricsQuerySchema,
  ) {
    const referenceDate = new Date();
    let range: ResolvedDashboardMetricsRange;

    try {
      const rangeQuery: DashboardMetricsRangeQuery = {
        ...(query.period !== undefined ? { period: query.period } : {}),
        ...(query.startsAt !== undefined ? { startsAt: query.startsAt } : {}),
        ...(query.endsAt !== undefined ? { endsAt: query.endsAt } : {}),
      };

      range = resolveDashboardMetricsRange(rangeQuery, { referenceDate });
    } catch (error) {
      if (error instanceof InvalidDashboardMetricsRangeError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }

    const result = await this.getTopCustomers.execute({
      establishmentOwnerId: user.userId,
      range,
      pagination: {
        page: query.page,
        size: query.size,
      },
    });
    const metrics = unwrapDashboardMetricsResult(result);

    return DashboardMetricsPresenter.toTopCustomers(
      metrics.customers,
      metrics.totalCustomers,
    );
  }
}
