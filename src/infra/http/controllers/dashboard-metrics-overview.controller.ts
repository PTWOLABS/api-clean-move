import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { GetEstablishmentDashboardOverviewUseCase } from "../../../modules/application/use-cases/establishment/get-establishment-dashboard-overview";
import {
  DashboardMetricsRangeQuery,
  InvalidDashboardMetricsRangeError,
  ResolvedDashboardMetricsRange,
  resolveDashboardMetricsRange,
} from "../../../modules/application/services/dashboard-metrics-range-resolver";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { DashboardMetricsOverviewResponseDto } from "../docs/domain-swagger.dto";
import { DashboardMetricsPresenter } from "../presenters/dashboard-metrics-presenter";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import {
  ApiDashboardMetricsErrors,
  ApiDashboardOverviewMetricsFilterQueries,
  buildMetricsFilters,
  DashboardOverviewMetricsQuerySchema,
  dashboardOverviewMetricsQuerySchema,
  unwrapDashboardMetricsResult,
} from "./dashboard-metrics-http";

@ApiTags("dashboard metrics")
@ApiBearerAuth("access-token")
@Controller("/dashboard/metrics")
@Roles(["ESTABLISHMENT"])
export class DashboardMetricsOverviewController {
  constructor(
    private readonly getDashboardOverview: GetEstablishmentDashboardOverviewUseCase,
  ) {}

  @Get("overview")
  @ApiOperation({
    summary: "Get dashboard overview metrics.",
    description:
      "Returns overview card metrics with comparison values and reduced chart points for the authenticated establishment.",
  })
  @ApiDashboardOverviewMetricsFilterQueries()
  @ApiOkResponse({
    description: "Dashboard overview metrics returned successfully.",
    type: DashboardMetricsOverviewResponseDto,
  })
  @ApiDashboardMetricsErrors()
  async overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dashboardOverviewMetricsQuerySchema))
    query: DashboardOverviewMetricsQuerySchema,
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

    const filters = buildMetricsFilters(query);
    const result = await this.getDashboardOverview.execute({
      establishmentOwnerId: user.userId,
      range,
      filters,
    });
    const metrics = unwrapDashboardMetricsResult(result);

    return DashboardMetricsPresenter.toOverview(metrics);
  }
}
