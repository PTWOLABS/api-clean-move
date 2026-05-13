import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { GetEstablishmentAppointmentsCountUseCase } from "../../../modules/application/use-cases/establishment/get-establishment-appointments-count";
import { GetEstablishmentCancellationRateUseCase } from "../../../modules/application/use-cases/establishment/get-establishment-cancellation-rate";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { DashboardMetricsAppointmentsResponseDto } from "../docs/domain-swagger.dto";
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
export class DashboardMetricsAppointmentsController {
  constructor(
    private readonly getAppointmentsCount: GetEstablishmentAppointmentsCountUseCase,
    private readonly getCancellationRate: GetEstablishmentCancellationRateUseCase,
  ) {}

  @Get("appointments")
  @ApiOperation({
    summary: "Get appointment dashboard metrics.",
    description:
      "Returns appointment count and cancellation rate for the authenticated establishment.",
  })
  @ApiDashboardMetricsFilterQueries()
  @ApiOkResponse({
    description: "Appointment metrics returned successfully.",
    type: DashboardMetricsAppointmentsResponseDto,
  })
  @ApiDashboardMetricsErrors()
  async appointments(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dashboardMetricsQuerySchema))
    query: DashboardMetricsQuerySchema,
  ) {
    const filters = buildMetricsFilters(query);
    const [appointmentsCountResult, cancellationRateResult] = await Promise.all(
      [
        this.getAppointmentsCount.execute({
          establishmentOwnerId: user.userId,
          filters,
        }),
        this.getCancellationRate.execute({
          establishmentOwnerId: user.userId,
          filters,
        }),
      ],
    );
    const appointmentsCount = unwrapDashboardMetricsResult(
      appointmentsCountResult,
    );
    const cancellationRate = unwrapDashboardMetricsResult(
      cancellationRateResult,
    );

    return DashboardMetricsPresenter.toAppointments({
      appointmentsCount: appointmentsCount.appointmentsCount,
      cancellationRate: cancellationRate.cancellationRate,
    });
  }
}
