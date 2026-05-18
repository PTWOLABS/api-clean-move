import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { GetEstablishmentRevenueVsAppointmentsUseCase } from "../../../modules/application/use-cases/establishment/get-establishment-revenue-vs-appointments";
import {
  ResolvedDashboardMetricGranularity,
  resolveDashboardMetricGranularity,
} from "../../../modules/application/services/dashboard-metrics-bucket-builder";
import {
  DashboardMetricsRangeQuery,
  InvalidDashboardMetricsRangeError,
  ResolvedDashboardMetricsRange,
  resolveDashboardMetricsRange,
} from "../../../modules/application/services/dashboard-metrics-range-resolver";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { DashboardMetricsRevenueResponseDto } from "../docs/domain-swagger.dto";
import { DashboardMetricsPresenter } from "../presenters/dashboard-metrics-presenter";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import {
  ApiDashboardDynamicMetricsFilterQueries,
  ApiDashboardMetricsErrors,
  buildMetricsFilters,
  DashboardDynamicMetricsQuerySchema,
  dashboardDynamicMetricsQuerySchema,
  unwrapDashboardMetricsResult,
} from "./dashboard-metrics-http";

@ApiTags("dashboard metrics")
@ApiBearerAuth("access-token")
@Controller("/dashboard/metrics")
@Roles(["ESTABLISHMENT"])
export class DashboardMetricsRevenueController {
  constructor(
    private readonly getRevenueVsAppointments: GetEstablishmentRevenueVsAppointmentsUseCase,
  ) {}

  @Get("revenue")
  @ApiOperation({
    summary: "Get revenue versus appointments metrics.",
    description:
      "Returns daily net revenue and appointment count points for the authenticated establishment.",
  })
  @ApiDashboardDynamicMetricsFilterQueries()
  @ApiOkResponse({
    description: "Revenue metrics returned successfully.",
    type: DashboardMetricsRevenueResponseDto,
  })
  @ApiDashboardMetricsErrors()
  async revenue(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dashboardDynamicMetricsQuerySchema))
    query: DashboardDynamicMetricsQuerySchema,
  ) {
    const referenceDate = new Date();
    let range: ResolvedDashboardMetricsRange;
    let granularity: ResolvedDashboardMetricGranularity;

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
      granularity = resolveDashboardMetricGranularity({
        ...(query.granularity !== undefined
          ? { requestedGranularity: query.granularity }
          : {}),
        ...(range.period !== undefined ? { period: range.period } : {}),
        range: range.current,
        referenceDate,
      });
    } catch (error) {
      if (error instanceof InvalidDashboardMetricsRangeError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }

    const result = await this.getRevenueVsAppointments.execute({
      establishmentOwnerId: user.userId,
      range,
      granularity,
      filters: buildMetricsFilters(query),
    });
    const metrics = unwrapDashboardMetricsResult(result);

    return DashboardMetricsPresenter.toRevenue(
      metrics.points,
      metrics.summary,
      granularity,
    );
  }
}
