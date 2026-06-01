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
import { VEHICLE_LIST_SEARCH_TYPES } from "../../../modules/application/repositories/customer-vehicles-repository";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ListCustomerVehiclesResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { CustomerVehiclePresenter } from "../presenters/customer-vehicle-presenter";

const listVehiclesQuerySchema = z
  .object({
    customerId: z.uuid().optional(),
    search: z.string().trim().optional(),
    type: z.enum(VEHICLE_LIST_SEARCH_TYPES).optional(),
    page: z.coerce.number().int().positive().optional(),
    size: z.coerce.number().int().positive().optional(),
  })
  .refine((value) => {
    const hasSearch = value.search !== undefined && value.search.length > 0;
    const hasType = value.type !== undefined;

    if (!hasSearch && !hasType) {
      return true;
    }

    return hasSearch && hasType;
  }, "search and type must be provided together.");

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
      "Returns active vehicles owned by the establishment. Optional customerId limits results to one customer. Optional search and type filter by plate, customer name, model, brand, color, or year.",
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
    name: "search",
    required: false,
    type: String,
    description:
      "Search term. Must be sent together with type. Supported fields depend on type.",
    example: "Maria",
  })
  @ApiQuery({
    name: "type",
    required: false,
    enum: VEHICLE_LIST_SEARCH_TYPES,
    description:
      "Field to search in: plate, name (customer full name), model, brand, color, or year. Must be sent together with search.",
    example: "name",
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
    const search =
      query.search !== undefined && query.search.length > 0
        ? query.search
        : undefined;

    const result = await this.listVehicles.execute({
      establishmentOwnerId: user.userId,
      ...(query.customerId !== undefined
        ? { customerId: query.customerId }
        : {}),
      ...(search !== undefined && query.type !== undefined
        ? { search, searchType: query.type }
        : {}),
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
