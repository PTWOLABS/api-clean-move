import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { GetEstablishmentPopularServicesByCategoryUseCase } from "../../../modules/application/use-cases/establishment/get-establishment-popular-services-by-category";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { DashboardMetricsPopularServicesResponseDto } from "../docs/domain-swagger.dto";
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
  @ApiDashboardMetricsFilterQueries()
  @ApiOkResponse({
    description: "Popular service metrics returned successfully.",
    type: DashboardMetricsPopularServicesResponseDto,
  })
  @ApiDashboardMetricsErrors()
  async popularServices(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dashboardMetricsQuerySchema))
    query: DashboardMetricsQuerySchema,
  ) {
    const result = await this.getPopularServices.execute({
      establishmentOwnerId: user.userId,
      filters: buildMetricsFilters(query),
    });
    const metrics = unwrapDashboardMetricsResult(result);

    return DashboardMetricsPresenter.toPopularServices(metrics.popularServices);
  }
}
