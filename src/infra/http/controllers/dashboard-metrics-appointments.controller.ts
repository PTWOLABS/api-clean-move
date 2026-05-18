import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { GetEstablishmentCancellationRateUseCase } from "../../../modules/application/use-cases/establishment/get-establishment-cancellation-rate";
import {
  DashboardMetricsRangeQuery,
  InvalidDashboardMetricsRangeError,
  ResolvedDashboardMetricsRange,
  resolveDashboardMetricsRange,
} from "../../../modules/application/services/dashboard-metrics-range-resolver";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { DashboardMetricsAppointmentsResponseDto } from "../docs/domain-swagger.dto";
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
export class DashboardMetricsAppointmentsController {
  constructor(
    private readonly getCancellationRate: GetEstablishmentCancellationRateUseCase,
  ) {}

  @Get("appointments")
  @ApiOperation({
    summary: "Get appointment dashboard metrics.",
    description:
      "Returns appointment count and cancellation rate for the authenticated establishment.",
  })
  @ApiDashboardDynamicMetricsFilterQueries()
  @ApiOkResponse({
    description: "Appointment metrics returned successfully.",
    type: DashboardMetricsAppointmentsResponseDto,
  })
  @ApiDashboardMetricsErrors()
  async appointments(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dashboardDynamicMetricsQuerySchema))
    query: DashboardDynamicMetricsQuerySchema,
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

    const result = await this.getCancellationRate.execute({
      establishmentOwnerId: user.userId,
      range,
      filters: buildMetricsFilters(query),
    });
    const metrics = unwrapDashboardMetricsResult(result);

    return DashboardMetricsPresenter.toAppointments(metrics);
  }
}
