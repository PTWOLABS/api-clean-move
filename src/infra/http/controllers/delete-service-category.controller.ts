import {
  BadRequestException,
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Delete,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { DeleteServiceCategoryUseCase } from "../../../modules/application/use-cases/service-category/delete-service-category";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ServiceCategoryResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { ServiceCategoryPresenter } from "../presenters/service-category-presenter";

const categoryIdParamSchema = z.uuid();

@ApiTags("service-categories")
@ApiBearerAuth("access-token")
@Controller("/service-categories/:categoryId")
@Roles(["ESTABLISHMENT"])
export class DeleteServiceCategoryController {
  constructor(
    private readonly deleteServiceCategory: DeleteServiceCategoryUseCase,
  ) {}

  @Delete()
  @ApiOperation({
    summary: "Soft delete a service category.",
  })
  @ApiParam({
    name: "categoryId",
    description: "Service category identifier.",
    format: "uuid",
  })
  @ApiOkResponse({
    description: "Service category deleted successfully.",
    type: ServiceCategoryResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description: "Authenticated user does not have the establishment role.",
  })
  @ApiNotFoundResponse({
    description: "Establishment profile or service category was not found.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while deleting the service category.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("categoryId", new ZodValidationPipe(categoryIdParamSchema))
    categoryId: string,
  ) {
    const result = await this.deleteServiceCategory.execute({
      establishmentOwnerId: user.userId,
      categoryId,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new BadRequestException(error.message);
      }
    }

    return {
      category: ServiceCategoryPresenter.toHTTP(result.value.category),
    };
  }
}
