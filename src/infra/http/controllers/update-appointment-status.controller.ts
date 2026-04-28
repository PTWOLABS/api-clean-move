import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import z from "zod";

import { UpdateAppointmentStatusUseCase } from "../../../modules/application/use-cases/appointment/update-appointment-status";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  AppointmentResponseDto,
  UpdateAppointmentStatusBodyDto,
} from "../docs/domain-swagger.dto";
import { AppointmentPresenter } from "../presenters/appointment-presenter";
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
@Roles(["ESTABLISHMENT"])
export class UpdateAppointmentStatusController {
  constructor(
    private readonly updateAppointmentStatus: UpdateAppointmentStatusUseCase,
  ) {}

  @Patch()
  @ApiBody({ type: UpdateAppointmentStatusBodyDto })
  @ApiOkResponse({ type: AppointmentResponseDto })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("appointmentId", new ZodValidationPipe(appointmentIdParamSchema))
    appointmentId: string,
    @Body(new ZodValidationPipe(updateAppointmentStatusBodySchema))
    body: UpdateAppointmentStatusBodySchema,
  ) {
    const result = await this.updateAppointmentStatus.execute({
      establishmentOwnerId: user.userId,
      appointmentId,
      status: body.status,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new BadRequestException(error.message);
      }
    }

    return {
      appointment: AppointmentPresenter.toHTTP(result.value.appointment),
    };
  }
}
