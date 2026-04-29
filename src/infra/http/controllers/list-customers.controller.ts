import {
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Get,
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

import { ListCustomersUseCase } from "../../../modules/application/use-cases/customer/list-customers";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ListCustomersResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { CustomerPresenter } from "../presenters/customer-presenter";

const listCustomersQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  size: z.coerce.number().int().positive().optional(),
});

type ListCustomersQuerySchema = z.infer<typeof listCustomersQuerySchema>;

@ApiTags("customers")
@ApiBearerAuth("access-token")
@Controller("/customers")
@Roles(["ESTABLISHMENT"])
export class ListCustomersController {
  constructor(private readonly listCustomers: ListCustomersUseCase) {}

  @Get()
  @ApiOperation({
    summary: "List active customers for the authenticated establishment.",
    description:
      "Returns active internal customer records. The optional search term is applied to customer name, phone, email, and CPF/CNPJ.",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search by full name, phone, email, CPF, or CNPJ.",
    example: "Maria",
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
    description: "Customers listed successfully.",
    type: ListCustomersResponseDto,
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
    description: "Unexpected failure while listing customers.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listCustomersQuerySchema))
    query: ListCustomersQuerySchema,
  ) {
    const result = await this.listCustomers.execute({
      establishmentOwnerId: user.userId,
      ...(query.search !== undefined ? { search: query.search } : {}),
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
      customers: result.value.customers.map((customer) =>
        CustomerPresenter.toHTTP(customer),
      ),
    };
  }
}
