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

import { ListVehiclesUseCase } from "../../../modules/application/use-cases/customer/list-vehicles";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ListCustomerVehiclesResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { CustomerVehiclePresenter } from "../presenters/customer-vehicle-presenter";

const optionalFilterString = z
  .string()
  .trim()
  .optional()
  .transform((value) =>
    value === undefined || value.length === 0 ? undefined : value,
  );

const listVehiclesQuerySchema = z.object({
  customerId: z.uuid().optional(),
  plate: optionalFilterString,
  name: optionalFilterString,
  model: optionalFilterString,
  brand: optionalFilterString,
  color: optionalFilterString,
  year: optionalFilterString,
  page: z.coerce.number().int().positive().optional(),
  size: z.coerce.number().int().positive().optional(),
});

type ListVehiclesQuerySchema = z.infer<typeof listVehiclesQuerySchema>;

@ApiTags("customer vehicles")
@ApiBearerAuth("access-token")
@Controller("/vehicles")
@Roles(["ESTABLISHMENT"])
export class ListVehiclesController {
  constructor(private readonly listVehicles: ListVehiclesUseCase) {}

  @Get()
  @ApiOperation({
    summary: "List active vehicles for the authenticated establishment.",
    description:
      "Returns active vehicles owned by the establishment. Optional customerId limits results to one customer. Optional plate, name, model, brand, color, and year filters can be combined with AND logic.",
  })
  @ApiQuery({
    name: "customerId",
    required: false,
    type: String,
    format: "uuid",
    description:
      "Optional active customer identifier used to limit listed vehicles.",
  })
  @ApiQuery({
    name: "plate",
    required: false,
    type: String,
    description: "Filter by plate. Supports punctuation in the input value.",
    example: "ABC1D23",
  })
  @ApiQuery({
    name: "name",
    required: false,
    type: String,
    description: "Filter by customer full name (case-insensitive).",
    example: "Maria",
  })
  @ApiQuery({
    name: "model",
    required: false,
    type: String,
    description: "Filter by vehicle model (case-insensitive).",
    example: "Gol",
  })
  @ApiQuery({
    name: "brand",
    required: false,
    type: String,
    description: "Filter by vehicle brand (case-insensitive).",
    example: "Volkswagen",
  })
  @ApiQuery({
    name: "color",
    required: false,
    type: String,
    description: "Filter by vehicle color (case-insensitive).",
    example: "Branco",
  })
  @ApiQuery({
    name: "year",
    required: false,
    type: String,
    description: "Filter by exact vehicle year.",
    example: "2020",
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
    description: "Vehicles listed successfully.",
    type: ListCustomerVehiclesResponseDto,
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
      "Customer was not found for the authenticated establishment, or the establishment profile does not exist.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while listing vehicles.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listVehiclesQuerySchema))
    query: ListVehiclesQuerySchema,
  ) {
    const result = await this.listVehicles.execute({
      establishmentOwnerId: user.userId,
      ...(query.customerId !== undefined
        ? { customerId: query.customerId }
        : {}),
      ...(query.plate !== undefined ? { plate: query.plate } : {}),
      ...(query.name !== undefined ? { name: query.name } : {}),
      ...(query.model !== undefined ? { model: query.model } : {}),
      ...(query.brand !== undefined ? { brand: query.brand } : {}),
      ...(query.color !== undefined ? { color: query.color } : {}),
      ...(query.year !== undefined ? { year: query.year } : {}),
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.size !== undefined ? { size: query.size } : {}),
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
      vehicles: result.value.vehicles.map((vehicle) =>
        CustomerVehiclePresenter.toHTTP(vehicle),
      ),
      totalItems: result.value.totalItems,
    };
  }
}
