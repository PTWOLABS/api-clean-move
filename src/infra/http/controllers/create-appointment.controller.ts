import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { CreateAppointmentUseCase } from "../../../modules/application/use-cases/appointment/create-appointment";
import { InactiveServiceError } from "../../../modules/catalog/domain/errors/inactive-service-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  AppointmentResponseDto,
  CreateAppointmentBodyDto,
} from "../docs/domain-swagger.dto";
import { AppointmentPresenter } from "../presenters/appointment-presenter";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const createAppointmentBodySchema = z.object({
  customerId: z.uuid(),
  serviceId: z.uuid(),
  vehicleId: z.uuid().optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  discountInCents: z.number().int().nonnegative().optional().nullable(),
});

type CreateAppointmentBodySchema = z.infer<typeof createAppointmentBodySchema>;

@ApiTags("appointments")
@ApiBearerAuth("access-token")
@Controller("/appointments")
@Roles(["ESTABLISHMENT"])
export class CreateAppointmentController {
  constructor(private readonly createAppointment: CreateAppointmentUseCase) {}

  @Post()
  @ApiOperation({
    summary: "Create an appointment for the authenticated establishment.",
    description:
      "Creates an operational appointment for an existing active customer and active service. The optional vehicle must belong to the selected customer. Overlapping appointments are allowed.",
  })
  @ApiBody({ type: CreateAppointmentBodyDto })
  @ApiCreatedResponse({
    description: "Appointment created successfully.",
    type: AppointmentResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, inactive service, invalid dates, invalid discount, deleted customer/vehicle, or vehicle that does not belong to the selected customer.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description: "Authenticated user does not have the establishment role.",
  })
  @ApiNotFoundResponse({
    description:
      "Customer, service, vehicle, or establishment profile was not found for the authenticated establishment.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while creating the appointment.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createAppointmentBodySchema))
    body: CreateAppointmentBodySchema,
  ) {
    const result = await this.createAppointment.execute({
      establishmentOwnerId: user.userId,
      customerId: body.customerId,
      serviceId: body.serviceId,
      startsAt: body.startsAt,
      ...(body.vehicleId !== undefined ? { vehicleId: body.vehicleId } : {}),
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
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case InactiveServiceError:
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
