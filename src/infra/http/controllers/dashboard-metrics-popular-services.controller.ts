import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { GetEstablishmentPopularServicesByCategoryUseCase } from "../../../modules/application/use-cases/establishment/get-establishment-popular-services-by-category";
import {
  DashboardMetricsRangeQuery,
  InvalidDashboardMetricsRangeError,
  ResolvedDashboardMetricsRange,
  resolveDashboardMetricsRange,
} from "../../../modules/application/services/dashboard-metrics-range-resolver";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { DashboardMetricsPopularServicesResponseDto } from "../docs/domain-swagger.dto";
import { DashboardMetricsPresenter } from "../presenters/dashboard-metrics-presenter";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import {
  ApiDashboardDynamicMetricsFilterQueries,
  ApiDashboardMetricsErrors,
  ApiDashboardPopularServicesPaginationQueries,
  buildMetricsFilters,
  DashboardPopularServicesMetricsQuerySchema,
  dashboardPopularServicesMetricsQuerySchema,
  unwrapDashboardMetricsResult,
} from "./dashboard-metrics-http";

@ApiTags("dashboard metrics")
@ApiBearerAuth("access-token")
@Controller("/dashboard/metrics")
@Roles(["ESTABLISHMENT"])
export class DashboardMetricsPopularServicesController {
  constructor(
    private readonly getPopularServices: GetEstablishmentPopularServicesByCategoryUseCase,
  ) {}

  @Get("popular-services")
  @ApiOperation({
    summary: "Get popular service dashboard metrics.",
    description:
      "Returns services grouped by booked service snapshot and ordered by appointment count, then revenue.",
  })
  @ApiDashboardDynamicMetricsFilterQueries()
  @ApiDashboardPopularServicesPaginationQueries()
  @ApiOkResponse({
    description: "Popular service metrics returned successfully.",
    type: DashboardMetricsPopularServicesResponseDto,
  })
  @ApiDashboardMetricsErrors()
  async popularServices(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dashboardPopularServicesMetricsQuerySchema))
    query: DashboardPopularServicesMetricsQuerySchema,
  ) {
    const referenceDate = new Date();
    let range: ResolvedDashboardMetricsRange;

    try {
      const rangeQuery: DashboardMetricsRangeQuery = {
        ...(query.period !== undefined ? { period: query.period } : {}),
        ...(query.startsAt !== undefined ? { startsAt: query.startsAt } : {}),
        ...(query.endsAt !== undefined ? { endsAt: query.endsAt } : {}),
        ...(query.granularity !== undefined
          ? { granularity: query.granularity }
          : {}),
      };

      range = resolveDashboardMetricsRange(rangeQuery, { referenceDate });
    } catch (error) {
      if (error instanceof InvalidDashboardMetricsRangeError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }

    const result = await this.getPopularServices.execute({
      establishmentOwnerId: user.userId,
      range,
      pagination: {
        page: query.page,
        size: query.size,
      },
      filters: buildMetricsFilters(query),
    });
    const metrics = unwrapDashboardMetricsResult(result);

    return DashboardMetricsPresenter.toPopularServices(
      metrics.popularServices,
      metrics.totalServices,
    );
  }
}
