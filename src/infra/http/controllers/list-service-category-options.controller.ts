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

import { ListServiceCategoryOptionsUseCase } from "../../../modules/application/use-cases/service-category/list-service-category-options";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ServiceCategoryOptionsResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listServiceCategoryOptionsQuerySchema = z.object({
  search: z.string().trim().optional(),
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
  })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "size", required: false, type: Number })
  @ApiOkResponse({
    description: "Service category options listed successfully.",
    type: ServiceCategoryOptionsResponseDto,
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
      ...(query.size !== undefined ? { size: query.size } : {}),
    });

    if (result.isLeft()) {
      throw new NotFoundException(result.value.message);
    }

    return {
      categories: result.value.categories,
      totalItems: result.value.totalItems,
    };
  }
}
