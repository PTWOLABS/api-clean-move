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

import { ListCustomerVehicleOptionsUseCase } from "../../../modules/application/use-cases/customer/list-customer-vehicle-options";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { EmployeeFeatures } from "../../auth/employee-features";
import { Roles } from "../../auth/roles";
import { CustomerVehicleOptionsResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listCustomerVehicleOptionsQuerySchema = z.object({
  search: z.string().trim().optional(),
  customerId: z.uuid().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

type ListCustomerVehicleOptionsQuerySchema = z.infer<
  typeof listCustomerVehicleOptionsQuerySchema
>;

@ApiTags("customer vehicles")
@ApiBearerAuth("access-token")
@Controller("/vehicles/options")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["read:customers"])
export class ListCustomerVehicleOptionsController {
  constructor(
    private readonly listCustomerVehicleOptions: ListCustomerVehicleOptionsUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List vehicle options for the authenticated establishment.",
    description:
      "Returns active vehicle options with only id and label. The optional search term is applied to plate, model, and brand.",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search by vehicle plate, model, or brand.",
    example: "Gol",
  })
  @ApiQuery({
    name: "customerId",
    required: false,
    type: String,
    format: "uuid",
    description:
      "Optional active customer identifier used to limit vehicle options.",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Positive maximum number of options. Defaults to 20.",
    example: 20,
  })
  @ApiOkResponse({
    description: "Vehicle options listed successfully.",
    type: CustomerVehicleOptionsResponseDto,
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
      "Customer was not found for the authenticated establishment, or the establishment profile does not exist.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while listing vehicle options.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listCustomerVehicleOptionsQuerySchema))
    query: ListCustomerVehicleOptionsQuerySchema,
  ) {
    const result = await this.listCustomerVehicleOptions.execute({
      actor: {
        userId: user.userId,
        role: user.role,
      },
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.customerId !== undefined
        ? { customerId: query.customerId }
        : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case NotAllowedError:
          throw new ForbiddenException(error.message);
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        default:
          throw new InternalServerErrorException(error.message);
      }
    }

    return {
      vehicles: result.value.vehicles,
    };
  }
}
