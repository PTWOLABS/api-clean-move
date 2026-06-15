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

import { UpdateAppointmentUseCase } from "../../../modules/application/use-cases/appointment/update-appointment";
import { InactiveServiceError } from "../../../modules/catalog/domain/errors/inactive-service-error";
import { InvalidAppointmentInputError } from "../../../modules/scheduling/domain/errors/invalid-appointment-input-error";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { EmployeeFeatures } from "../../auth/employee-features";
import { Roles } from "../../auth/roles";
import {
  AppointmentResponseDto,
  UpdateAppointmentBodyDto,
} from "../docs/domain-swagger.dto";
import { AppointmentPresenter } from "../presenters/appointment-presenter";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const updateAppointmentBodySchema = z
  .object({
    customerId: z.uuid().optional(),
    serviceIds: z.array(z.uuid()).min(1).optional(),
    vehicleId: z.uuid().optional().nullable(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional().nullable(),
    description: z.string().trim().optional().nullable(),
    discountInCents: z.number().int().nonnegative().optional().nullable(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field must be provided.",
  );

type UpdateAppointmentBodySchema = z.infer<typeof updateAppointmentBodySchema>;
const appointmentIdParamSchema = z.uuid();

@ApiTags("appointments")
@ApiBearerAuth("access-token")
@Controller("/appointments/:appointmentId")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["update:appointments"])
export class UpdateAppointmentController {
  constructor(private readonly updateAppointment: UpdateAppointmentUseCase) {}

  @Patch()
  @ApiOperation({
    summary: "Update an appointment operational data.",
    description:
      "Partially updates appointment customer, services, vehicle, dates, description, and discount after validating establishment ownership.",
  })
  @ApiParam({
    name: "appointmentId",
    description: "Appointment identifier.",
    format: "uuid",
  })
  @ApiBody({
    type: UpdateAppointmentBodyDto,
    description:
      "At least one field must be provided. Omitted fields are preserved and nullable fields can be cleared with null.",
  })
  @ApiOkResponse({
    description: "Appointment updated successfully.",
    type: AppointmentResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid appointment id, empty update payload, invalid field value, inactive service, invalid dates, or invalid discount.",
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
      "Appointment, customer, service, vehicle, or establishment profile was not found for the authenticated establishment.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while updating the appointment.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("appointmentId", new ZodValidationPipe(appointmentIdParamSchema))
    appointmentId: string,
    @Body(new ZodValidationPipe(updateAppointmentBodySchema))
    body: UpdateAppointmentBodySchema,
  ) {
    const result = await this.updateAppointment.execute({
      actor: {
        userId: user.userId,
        role: user.role,
      },
      appointmentId,
      ...(body.customerId !== undefined ? { customerId: body.customerId } : {}),
      ...(body.serviceIds !== undefined ? { serviceIds: body.serviceIds } : {}),
      ...(body.vehicleId !== undefined ? { vehicleId: body.vehicleId } : {}),
      ...(body.startsAt !== undefined ? { startsAt: body.startsAt } : {}),
      ...(body.endsAt !== undefined ? { endsAt: body.endsAt } : {}),
      ...(body.description !== undefined
        ? { description: body.description }
        : {}),
      ...(body.discountInCents !== undefined
        ? { discountInCents: body.discountInCents }
        : {}),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case NotAllowedError:
          throw new ForbiddenException(error.message);
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case InactiveServiceError:
          throw new BadRequestException(error.message);
        case InvalidAppointmentInputError:
          throw new BadRequestException(error.message);
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
