import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { GetEstablishmentRevenueVsAppointmentsUseCase } from "../../../modules/application/use-cases/establishment/get-establishment-revenue-vs-appointments";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { DashboardMetricsRevenueResponseDto } from "../docs/domain-swagger.dto";
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
  @ApiDashboardMetricsFilterQueries()
  @ApiOkResponse({
    description: "Revenue metrics returned successfully.",
    type: DashboardMetricsRevenueResponseDto,
  })
  @ApiDashboardMetricsErrors()
  async revenue(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dashboardMetricsQuerySchema))
    query: DashboardMetricsQuerySchema,
  ) {
    const result = await this.getRevenueVsAppointments.execute({
      establishmentOwnerId: user.userId,
      filters: buildMetricsFilters(query),
    });
    const metrics = unwrapDashboardMetricsResult(result);

    return DashboardMetricsPresenter.toRevenue(metrics.points);
  }
}
