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

const appointmentTextFilterSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .optional();

const listAppointmentsQuerySchema = z.object({
  search: appointmentTextFilterSchema,
  customerId: z.uuid().optional(),
  customerName: appointmentTextFilterSchema,
  customerNickname: appointmentTextFilterSchema,
  vehicleId: z.uuid().optional(),
  vehiclePlate: appointmentTextFilterSchema,
  vehicleBrand: appointmentTextFilterSchema,
  vehicleModel: appointmentTextFilterSchema,
  serviceId: z.uuid().optional(),
  serviceName: appointmentTextFilterSchema,
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
      "Returns operational appointments for the authenticated establishment. Filters can be combined to narrow by customer, vehicle, service, status, text search, and startsAt interval.",
  })
  @ApiQuery({
    name: "search",
    required: false,
    schema: {
      type: "string",
      minLength: 1,
      maxLength: 100,
    },
    description:
      "General text search across customer full name, customer nickname, booked service name, vehicle plate, vehicle brand, and vehicle model. Non-alphanumeric characters are removed when matching against vehicle plate.",
    example: "Maria",
  })
  @ApiQuery({
    name: "customerId",
    required: false,
    type: String,
    format: "uuid",
    description: "Filter by customer identifier.",
  })
  @ApiQuery({
    name: "customerName",
    required: false,
    schema: {
      type: "string",
      minLength: 1,
      maxLength: 100,
    },
    description: "Filter by current customer full name.",
    example: "Maria Silva",
  })
  @ApiQuery({
    name: "customerNickname",
    required: false,
    schema: {
      type: "string",
      minLength: 1,
      maxLength: 100,
    },
    description: "Filter by current customer nickname.",
    example: "Maria",
  })
  @ApiQuery({
    name: "vehicleId",
    required: false,
    type: String,
    format: "uuid",
    description: "Filter by customer vehicle identifier.",
  })
  @ApiQuery({
    name: "vehiclePlate",
    required: false,
    schema: {
      type: "string",
      minLength: 1,
      maxLength: 100,
    },
    description:
      "Filter by vehicle plate snapshot. Non-alphanumeric characters are removed before matching.",
    example: "ABC1D23",
  })
  @ApiQuery({
    name: "vehicleBrand",
    required: false,
    schema: {
      type: "string",
      minLength: 1,
      maxLength: 100,
    },
    description: "Filter by vehicle brand snapshot.",
    example: "Toyota",
  })
  @ApiQuery({
    name: "vehicleModel",
    required: false,
    schema: {
      type: "string",
      minLength: 1,
      maxLength: 100,
    },
    description: "Filter by vehicle model snapshot.",
    example: "Corolla",
  })
  @ApiQuery({
    name: "serviceId",
    required: false,
    type: String,
    format: "uuid",
    description: "Filter by service identifier.",
  })
  @ApiQuery({
    name: "serviceName",
    required: false,
    schema: {
      type: "string",
      minLength: 1,
      maxLength: 100,
    },
    description: "Filter by booked service name snapshot.",
    example: "Lavagem premium",
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
        ...(query.search !== undefined ? { search: query.search } : {}),
        ...(query.customerId !== undefined
          ? { customerId: query.customerId }
          : {}),
        ...(query.customerName !== undefined
          ? { customerName: query.customerName }
          : {}),
        ...(query.customerNickname !== undefined
          ? { customerNickname: query.customerNickname }
          : {}),
        ...(query.vehicleId !== undefined
          ? { vehicleId: query.vehicleId }
          : {}),
        ...(query.vehiclePlate !== undefined
          ? { vehiclePlate: query.vehiclePlate }
          : {}),
        ...(query.vehicleBrand !== undefined
          ? { vehicleBrand: query.vehicleBrand }
          : {}),
        ...(query.vehicleModel !== undefined
          ? { vehicleModel: query.vehicleModel }
          : {}),
        ...(query.serviceId !== undefined
          ? { serviceId: query.serviceId }
          : {}),
        ...(query.serviceName !== undefined
          ? { serviceName: query.serviceName }
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
