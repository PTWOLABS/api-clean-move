import { Controller, Get, NotFoundException, Query } from "@nestjs/common";
import {
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

import { ListServiceCategoriesUseCase } from "../../../modules/application/use-cases/service-category/list-service-categories";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ListServiceCategoriesResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { ServiceCategoryPresenter } from "../presenters/service-category-presenter";

const listServiceCategoriesQuerySchema = z.object({
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

type ListServiceCategoriesQuerySchema = z.infer<
  typeof listServiceCategoriesQuerySchema
>;

@ApiTags("service-categories")
@ApiBearerAuth("access-token")
@Controller("/service-categories")
@Roles(["ESTABLISHMENT"])
export class ListServiceCategoriesController {
  constructor(
    private readonly listServiceCategories: ListServiceCategoriesUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List service categories for the authenticated establishment.",
  })
  @ApiQuery({
    name: "includeDeleted",
    required: false,
    enum: ["true", "false"],
  })
  @ApiOkResponse({
    description: "Service categories listed successfully.",
    type: ListServiceCategoriesResponseDto,
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
    description: "Unexpected failure while listing service categories.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listServiceCategoriesQuerySchema))
    query: ListServiceCategoriesQuerySchema,
  ) {
    const result = await this.listServiceCategories.execute({
      establishmentOwnerId: user.userId,
      ...(query.includeDeleted !== undefined
        ? { includeDeleted: query.includeDeleted }
        : {}),
    });

    if (result.isLeft()) {
      throw new NotFoundException(result.value.message);
    }

    return {
      categories: result.value.categories.map((category) =>
        ServiceCategoryPresenter.toHTTP(category),
      ),
    };
  }
}
