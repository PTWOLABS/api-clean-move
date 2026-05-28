import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { UpdateAppointmentStatusUseCase } from "../../../modules/application/use-cases/appointment/update-appointment-status";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { EmployeeFeatures } from "../../auth/employee-features";
import { Roles } from "../../auth/roles";
import {
  UpdateAppointmentStatusResponseDto,
  UpdateAppointmentStatusBodyDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const updateAppointmentStatusBodySchema = z.object({
  status: z.enum(["SCHEDULED", "DONE", "CANCELLED"]),
});

type UpdateAppointmentStatusBodySchema = z.infer<
  typeof updateAppointmentStatusBodySchema
>;
const appointmentIdParamSchema = z.uuid();

@ApiTags("appointments")
@ApiBearerAuth("access-token")
@Controller("/appointments/:appointmentId/status")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["update:appointments"])
export class UpdateAppointmentStatusController {
  constructor(
    private readonly updateAppointmentStatus: UpdateAppointmentStatusUseCase,
  ) {}

  @Patch()
  @ApiOperation({
    summary: "Update an appointment status manually.",
    description:
      "Changes an appointment status to SCHEDULED, DONE, or CANCELLED after validating that the appointment belongs to the authenticated establishment.",
  })
  @ApiParam({
    name: "appointmentId",
    description: "Appointment identifier.",
    format: "uuid",
  })
  @ApiBody({ type: UpdateAppointmentStatusBodyDto })
  @ApiOkResponse({
    description: "Appointment status updated successfully.",
    type: UpdateAppointmentStatusResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid appointment id or invalid status.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description:
      "Authenticated user does not have the required role or employee feature for this status change.",
  })
  @ApiNotFoundResponse({
    description:
      "Appointment was not found for the authenticated establishment, or the establishment profile does not exist.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while updating the appointment status.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("appointmentId", new ZodValidationPipe(appointmentIdParamSchema))
    appointmentId: string,
    @Body(new ZodValidationPipe(updateAppointmentStatusBodySchema))
    body: UpdateAppointmentStatusBodySchema,
  ) {
    const result = await this.updateAppointmentStatus.execute({
      actor: {
        userId: user.userId,
        role: user.role,
      },
      appointmentId,
      status: body.status,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case NotAllowedError:
          throw new ForbiddenException(error.message);
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new BadRequestException(error.message);
      }
    }

    return {
      appointment: {
        id: result.value.appointment.id.toString(),
        status: result.value.appointment.status,
        updatedAt: result.value.appointment.updatedAt.toISOString(),
        doneAt: result.value.appointment.doneAt?.toISOString() ?? null,
        cancelledAt:
          result.value.appointment.cancelledAt?.toISOString() ?? null,
      },
    };
  }
}
