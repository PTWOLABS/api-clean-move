import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { GetEstablishmentDashboardOverviewUseCase } from "../../../modules/application/use-cases/establishment/get-establishment-dashboard-overview";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { DashboardMetricsOverviewResponseDto } from "../docs/domain-swagger.dto";
import { DashboardMetricsPresenter } from "../presenters/dashboard-metrics-presenter";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import {
  ApiDashboardMetricsErrors,
  ApiDashboardMetricsFilterQueries,
  buildMetricsFilters,
  DashboardMetricsQuerySchema,
  dashboardMetricsQuerySchema,
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
      "Returns total net revenue, average ticket, appointment count, and cancellation rate for the authenticated establishment.",
  })
  @ApiDashboardMetricsFilterQueries()
  @ApiOkResponse({
    description: "Dashboard overview metrics returned successfully.",
    type: DashboardMetricsOverviewResponseDto,
  })
  @ApiDashboardMetricsErrors()
  async overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dashboardMetricsQuerySchema))
    query: DashboardMetricsQuerySchema,
  ) {
    const filters = buildMetricsFilters(query);
    const result = await this.getDashboardOverview.execute({
      establishmentOwnerId: user.userId,
      filters,
    });
    const metrics = unwrapDashboardMetricsResult(result);

    return DashboardMetricsPresenter.toOverview(metrics);
  }
}
