import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
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

import { InvalidServiceCategoryInputError } from "../../../modules/application/use-cases/service-category/create-service-category";
import { UpdateServiceCategoryUseCase } from "../../../modules/application/use-cases/service-category/update-service-category";
import { ResourceAlreadyExistsError } from "../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  ServiceCategoryResponseDto,
  UpdateServiceCategoryBodyDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { ServiceCategoryPresenter } from "../presenters/service-category-presenter";

const updateServiceCategoryBodySchema = z.object({
  name: z.string().trim().min(1),
});

const categoryIdParamSchema = z.uuid();

@ApiTags("service-categories")
@ApiBearerAuth("access-token")
@Controller("/service-categories/:categoryId")
@Roles(["ESTABLISHMENT"])
export class UpdateServiceCategoryController {
  constructor(
    private readonly updateServiceCategory: UpdateServiceCategoryUseCase,
  ) {}

  @Patch()
  @ApiOperation({
    summary: "Rename a service category.",
  })
  @ApiParam({
    name: "categoryId",
    description: "Service category identifier.",
    format: "uuid",
  })
  @ApiBody({ type: UpdateServiceCategoryBodyDto })
  @ApiOkResponse({
    description: "Service category updated successfully.",
    type: ServiceCategoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid category name.",
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
  @ApiConflictResponse({
    description: "A category with this name already exists.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while updating the service category.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("categoryId", new ZodValidationPipe(categoryIdParamSchema))
    categoryId: string,
    @Body(new ZodValidationPipe(updateServiceCategoryBodySchema))
    body: z.infer<typeof updateServiceCategoryBodySchema>,
  ) {
    const result = await this.updateServiceCategory.execute({
      establishmentOwnerId: user.userId,
      categoryId,
      name: body.name,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceAlreadyExistsError:
          throw new ConflictException(error.message);
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case InvalidServiceCategoryInputError:
          throw new BadRequestException(error.message);
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
