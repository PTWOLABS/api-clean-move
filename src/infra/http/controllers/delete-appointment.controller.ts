import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { DeleteAppointmentUseCase } from "../../../modules/application/use-cases/appointment/delete-appointment";
import { DoneAppointmentCannotBeDeletedError } from "../../../modules/scheduling/domain/errors/done-appointment-cannot-be-deleted-error";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { EmployeeFeatures } from "../../auth/employee-features";
import { Roles } from "../../auth/roles";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const appointmentIdParamSchema = z.uuid();

@ApiTags("appointments")
@ApiBearerAuth("access-token")
@Controller("/appointments/:appointmentId")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["delete:appointments"])
export class DeleteAppointmentController {
  constructor(private readonly deleteAppointment: DeleteAppointmentUseCase) {}

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary: "Delete an appointment.",
    description:
      "Deletes an appointment after validating that it belongs to the authenticated establishment.",
  })
  @ApiParam({
    name: "appointmentId",
    description: "Appointment identifier.",
    format: "uuid",
  })
  @ApiNoContentResponse({ description: "Appointment deleted successfully." })
  @ApiBadRequestResponse({
    description: "Invalid appointment id.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description:
      "Authenticated user does not have the required role or employee feature.",
  })
  @ApiNotFoundResponse({
    description:
      "Appointment or establishment profile was not found for the authenticated establishment.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while deleting the appointment.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("appointmentId", new ZodValidationPipe(appointmentIdParamSchema))
    appointmentId: string,
  ) {
    const result = await this.deleteAppointment.execute({
      actor: {
        userId: user.userId,
        role: user.role,
      },
      appointmentId,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case NotAllowedError:
          throw new ForbiddenException(error.message);
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case DoneAppointmentCannotBeDeletedError:
          throw new BadRequestException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new InternalServerErrorException(error.message);
      }
    }
  }
}
