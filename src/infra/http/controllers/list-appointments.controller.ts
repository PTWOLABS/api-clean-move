import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
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
  @ApiOkResponse({ type: ListAppointmentsResponseDto })
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
