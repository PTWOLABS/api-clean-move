import {
  Controller,
  ForbiddenException,
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

import { CALENDAR_MAX_RANGE_MS } from "../../../modules/application/constants/appointment-calendar";
import { ListCalendarAppointmentsUseCase } from "../../../modules/application/use-cases/appointment/list-calendar-appointments";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { EmployeeFeatures } from "../../auth/employee-features";
import { Roles } from "../../auth/roles";
import { ListAppointmentsResponseDto } from "../docs/domain-swagger.dto";
import { AppointmentPresenter } from "../presenters/appointment-presenter";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listCalendarAppointmentsQuerySchema = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    status: z.enum(["SCHEDULED", "DONE", "CANCELLED"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (Number.isNaN(data.startsAt.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid startsAt date.",
        path: ["startsAt"],
      });
    }

    if (Number.isNaN(data.endsAt.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid endsAt date.",
        path: ["endsAt"],
      });
    }

    if (data.endsAt.getTime() <= data.startsAt.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: "endsAt must be greater than startsAt.",
        path: ["endsAt"],
      });
    }

    if (
      data.endsAt.getTime() - data.startsAt.getTime() >
      CALENDAR_MAX_RANGE_MS
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Range cannot exceed 42 days.",
        path: ["endsAt"],
      });
    }
  });

type ListCalendarAppointmentsQuerySchema = z.infer<
  typeof listCalendarAppointmentsQuerySchema
>;

@ApiTags("appointments")
@ApiBearerAuth("access-token")
@Controller("/appointments")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["read:appointments"])
export class ListCalendarAppointmentsController {
  constructor(
    private readonly listCalendarAppointments: ListCalendarAppointmentsUseCase,
  ) {}

  @Get("calendar")
  @ApiOperation({
    summary: "List appointments for calendar view within a date range.",
    description:
      "Returns all operational appointments that intersect the requested interval for the authenticated establishment. The interval cannot exceed 42 days.",
  })
  @ApiQuery({
    name: "startsAt",
    required: true,
    type: String,
    format: "date-time",
    description: "Inclusive start of the calendar interval in ISO 8601 format.",
    example: "2026-04-10T00:00:00.000Z",
  })
  @ApiQuery({
    name: "endsAt",
    required: true,
    type: String,
    format: "date-time",
    description: "Exclusive end of the calendar interval in ISO 8601 format.",
    example: "2026-04-17T00:00:00.000Z",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["SCHEDULED", "DONE", "CANCELLED"],
    description: "Optional filter by operational appointment status.",
  })
  @ApiOkResponse({
    description: "Calendar appointments listed successfully.",
    type: ListAppointmentsResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid query parameters.",
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
      "The authenticated establishment user does not have an establishment profile.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while listing calendar appointments.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listCalendarAppointmentsQuerySchema))
    query: ListCalendarAppointmentsQuerySchema,
  ) {
    const result = await this.listCalendarAppointments.execute({
      actor: {
        userId: user.userId,
        role: user.role,
      },
      filters: {
        startsAt: query.startsAt,
        endsAt: query.endsAt,
        ...(query.status !== undefined ? { status: query.status } : {}),
      },
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
