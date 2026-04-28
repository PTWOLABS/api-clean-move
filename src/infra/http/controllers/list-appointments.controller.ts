import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { ListAppointmentsUseCase } from "../../../modules/application/use-cases/appointment/list-appointments";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ListAppointmentsResponseDto } from "../docs/domain-swagger.dto";
import { AppointmentPresenter } from "../presenters/appointment-presenter";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listAppointmentsQuerySchema = z.object({
  customerId: z.uuid().optional(),
  vehicleId: z.uuid().optional(),
  serviceId: z.uuid().optional(),
  status: z.enum(["SCHEDULED", "DONE", "CANCELLED"]).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional(),
  size: z.coerce.number().int().positive().optional(),
});

type ListAppointmentsQuerySchema = z.infer<typeof listAppointmentsQuerySchema>;

@ApiTags("appointments")
@ApiBearerAuth("access-token")
@Controller("/appointments")
@Roles(["ESTABLISHMENT"])
export class ListAppointmentsController {
  constructor(private readonly listAppointments: ListAppointmentsUseCase) {}

  @Get()
  @ApiOperation({
    summary: "List appointments for the authenticated establishment.",
    description:
      "Returns operational appointments for the authenticated establishment. Filters can be combined to narrow by customer, vehicle, service, status, and startsAt interval.",
  })
  @ApiQuery({
    name: "customerId",
    required: false,
    type: String,
    format: "uuid",
    description: "Filter by customer identifier.",
  })
  @ApiQuery({
    name: "vehicleId",
    required: false,
    type: String,
    format: "uuid",
    description: "Filter by customer vehicle identifier.",
  })
  @ApiQuery({
    name: "serviceId",
    required: false,
    type: String,
    format: "uuid",
    description: "Filter by service identifier.",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["SCHEDULED", "DONE", "CANCELLED"],
    description: "Filter by operational appointment status.",
  })
  @ApiQuery({
    name: "startsAt",
    required: false,
    type: String,
    format: "date-time",
    description:
      "Filter appointments starting at or after this ISO 8601 date-time.",
    example: "2026-04-22T00:00:00.000Z",
  })
  @ApiQuery({
    name: "endsAt",
    required: false,
    type: String,
    format: "date-time",
    description:
      "Filter appointments starting at or before this ISO 8601 date-time.",
    example: "2026-04-22T23:59:59.999Z",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Positive page number used for pagination.",
    example: 1,
  })
  @ApiQuery({
    name: "size",
    required: false,
    type: Number,
    description: "Positive page size used for pagination.",
    example: 20,
  })
  @ApiOkResponse({
    description: "Appointments listed successfully.",
    type: ListAppointmentsResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid query parameters.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description: "Authenticated user does not have the establishment role.",
  })
  @ApiNotFoundResponse({
    description:
      "The authenticated establishment user does not have an establishment profile.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while listing appointments.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listAppointmentsQuerySchema))
    query: ListAppointmentsQuerySchema,
  ) {
    const result = await this.listAppointments.execute({
      establishmentOwnerId: user.userId,
      filters: {
        ...(query.customerId !== undefined
          ? { customerId: query.customerId }
          : {}),
        ...(query.vehicleId !== undefined
          ? { vehicleId: query.vehicleId }
          : {}),
        ...(query.serviceId !== undefined
          ? { serviceId: query.serviceId }
          : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.startsAt !== undefined ? { startsAt: query.startsAt } : {}),
        ...(query.endsAt !== undefined ? { endsAt: query.endsAt } : {}),
        ...(query.page !== undefined ? { page: query.page } : {}),
        ...(query.size !== undefined ? { size: query.size } : {}),
      },
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new InternalServerErrorException(error.message);
      }
    }

    return {
      appointments: result.value.appointments.map((appointment) =>
        AppointmentPresenter.toHTTP(appointment),
      ),
    };
  }
}
