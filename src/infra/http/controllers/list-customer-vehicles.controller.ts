import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
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
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { ListCustomerVehiclesUseCase } from "../../../modules/application/use-cases/customer/list-customer-vehicles";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ListCustomerVehiclesResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { CustomerVehiclePresenter } from "../presenters/customer-vehicle-presenter";

const listCustomerVehiclesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  size: z.coerce.number().int().positive().optional(),
});

type ListCustomerVehiclesQuerySchema = z.infer<
  typeof listCustomerVehiclesQuerySchema
>;
const customerIdParamSchema = z.uuid();

@ApiTags("customer vehicles")
@ApiBearerAuth("access-token")
@Controller("/customers/:customerId/vehicles")
@Roles(["ESTABLISHMENT"])
export class ListCustomerVehiclesController {
  constructor(
    private readonly listCustomerVehicles: ListCustomerVehiclesUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List active vehicles for an internal customer.",
    description:
      "Returns active vehicles linked to a customer owned by the authenticated establishment.",
  })
  @ApiParam({
    name: "customerId",
    description: "Customer identifier.",
    format: "uuid",
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
    description: "Customer vehicles listed successfully.",
    type: ListCustomerVehiclesResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid customer id or invalid query parameters.",
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
    description: "Unexpected failure while listing customer vehicles.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("customerId", new ZodValidationPipe(customerIdParamSchema))
    customerId: string,
    @Query(new ZodValidationPipe(listCustomerVehiclesQuerySchema))
    query: ListCustomerVehiclesQuerySchema,
  ) {
    const result = await this.listCustomerVehicles.execute({
      establishmentOwnerId: user.userId,
      customerId,
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
    };
  }
}
