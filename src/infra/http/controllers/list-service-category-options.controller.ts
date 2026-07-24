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

import { ListServiceCategoryOptionsUseCase } from "../../../modules/application/use-cases/service-category/list-service-category-options";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ServiceCategoryOptionsResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listServiceCategoryOptionsQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  size: z.coerce.number().int().positive().optional(),
});

type ListServiceCategoryOptionsQuerySchema = z.infer<
  typeof listServiceCategoryOptionsQuerySchema
>;

@ApiTags("service-categories")
@ApiBearerAuth("access-token")
@Controller("/service-categories/options")
@Roles(["ESTABLISHMENT"])
export class ListServiceCategoryOptionsController {
  constructor(
    private readonly listServiceCategoryOptions: ListServiceCategoryOptionsUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List service category options for dropdowns.",
    description:
      "Returns active service category options with only id and label. The optional search term is applied to category name.",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search by service category name.",
    example: "Lavagem",
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
    description: "Service category options listed successfully.",
    type: ServiceCategoryOptionsResponseDto,
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
    description: "Unexpected failure while listing service category options.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listServiceCategoryOptionsQuerySchema))
    query: ListServiceCategoryOptionsQuerySchema,
  ) {
    const result = await this.listServiceCategoryOptions.execute({
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
        default:
          throw new InternalServerErrorException(error.message);
      }
    }

    return {
      categories: result.value.categories,
      totalItems: result.value.totalItems,
    };
  }
}
