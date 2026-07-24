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

import { ListCustomerOptionsUseCase } from "../../../modules/application/use-cases/customer/list-customer-options";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { EmployeeFeatures } from "../../auth/employee-features";
import { Roles } from "../../auth/roles";
import { CustomerOptionsResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listCustomerOptionsQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  size: z.coerce.number().int().positive().optional(),
});

type ListCustomerOptionsQuerySchema = z.infer<
  typeof listCustomerOptionsQuerySchema
>;

@ApiTags("customers")
@ApiBearerAuth("access-token")
@Controller("/customers/options")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["read:customers"])
export class ListCustomerOptionsController {
  constructor(
    private readonly listCustomerOptions: ListCustomerOptionsUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List customer options for the authenticated establishment.",
    description:
      "Returns active customer options with only id and label. The optional search term is applied to customer full name and nickname.",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search by customer full name or nickname.",
    example: "Ana",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Positive page number. Defaults to 1.",
    example: 1,
  })
  @ApiQuery({
    name: "size",
    required: false,
    type: Number,
    description: "Positive maximum number of options. Defaults to 20.",
    example: 20,
  })
  @ApiOkResponse({
    description: "Customer options listed successfully.",
    type: CustomerOptionsResponseDto,
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
    description: "Unexpected failure while listing customer options.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listCustomerOptionsQuerySchema))
    query: ListCustomerOptionsQuerySchema,
  ) {
    const result = await this.listCustomerOptions.execute({
      actor: {
        userId: user.userId,
        role: user.role,
      },
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.size !== undefined ? { size: query.size } : {}),
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
      customers: result.value.customers,
      totalItems: result.value.totalItems,
    };
  }
}
