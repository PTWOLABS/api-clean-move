import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import {
  CreateServiceCategoryUseCase,
  InvalidServiceCategoryInputError,
} from "../../../modules/application/use-cases/service-category/create-service-category";
import { ResourceAlreadyExistsError } from "../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  CreateServiceCategoryBodyDto,
  ServiceCategoryResponseDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { ServiceCategoryPresenter } from "../presenters/service-category-presenter";

const createServiceCategoryBodySchema = z.object({
  name: z.string().trim().min(1),
});

type CreateServiceCategoryBodySchema = z.infer<
  typeof createServiceCategoryBodySchema
>;

@ApiTags("service-categories")
@ApiBearerAuth("access-token")
@Controller("/service-categories")
@Roles(["ESTABLISHMENT"])
export class CreateServiceCategoryController {
  constructor(
    private readonly createServiceCategory: CreateServiceCategoryUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create a service category for the authenticated establishment.",
  })
  @ApiBody({ type: CreateServiceCategoryBodyDto })
  @ApiCreatedResponse({
    description: "Service category created successfully.",
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
    description:
      "The authenticated establishment user does not have an establishment profile.",
  })
  @ApiConflictResponse({
    description: "A category with this name already exists.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while creating the service category.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createServiceCategoryBodySchema))
    body: CreateServiceCategoryBodySchema,
  ) {
    const result = await this.createServiceCategory.execute({
      establishmentOwnerId: user.userId,
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
