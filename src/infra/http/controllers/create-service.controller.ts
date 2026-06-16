import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { CreateServiceUseCase } from "../../../modules/application/use-cases/service/create-service";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { InvalidServiceUpdateInputError } from "../../../modules/application/use-cases/service/update-service";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { ServicePresenter } from "../presenters/service-presenter";
import {
  CreateServiceBodyDto,
  CreateServiceResponseDto,
} from "../docs/domain-swagger.dto";

const priceSpecificationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("FIXED"),
      fixedPriceInCents: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("STARTING_AT"),
      minPriceInCents: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("RANGE"),
      minPriceInCents: z.number().int().nonnegative(),
      maxPriceInCents: z.number().int().nonnegative(),
    })
    .strict()
    .refine(
      (value) => value.maxPriceInCents >= value.minPriceInCents,
      "maxPriceInCents must be greater than or equal to minPriceInCents.",
    ),
]);

const createServiceBodySchema = z
  .object({
    serviceName: z.string().trim().min(1),
    description: z.string().trim().optional(),
    categoryId: z.uuid().optional().nullable(),
    estimatedDuration: z
      .object({
        minInMinutes: z.coerce.number().int().positive(),
        maxInMinutes: z.coerce.number().int().positive().optional(),
      })
      .optional(),
    price: z.number().int().nonnegative().optional(),
    priceSpecification: priceSpecificationSchema.optional(),
    isActive: z.boolean().optional().default(true),
  })
  .refine(
    (value) =>
      (value.price !== undefined || value.priceSpecification !== undefined) &&
      !(value.price !== undefined && value.priceSpecification !== undefined),
    "Provide either price or priceSpecification.",
  );

type CreateServiceBodySchema = z.infer<typeof createServiceBodySchema>;

@ApiTags("service")
@Controller("/services")
@Roles(["ESTABLISHMENT"])
export class CreateServiceController {
  constructor(private readonly createService: CreateServiceUseCase) {}

  @Post()
  @ApiOperation({
    summary: "Create a service for the authenticated establishment.",
  })
  @ApiBearerAuth("access-token")
  @ApiBody({ type: CreateServiceBodyDto })
  @ApiCreatedResponse({
    description: "Service created successfully.",
    type: CreateServiceResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload or invalid service data such as name, price, or estimated duration.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description:
      "Authenticated user does not have permission to create services.",
  })
  @ApiNotFoundResponse({
    description:
      "The authenticated establishment user does not have an establishment profile.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while creating the service.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createServiceBodySchema))
    body: CreateServiceBodySchema,
  ) {
    const {
      serviceName,
      description,
      categoryId,
      estimatedDuration,
      price,
      priceSpecification,
      isActive,
    } = body;

    const result = await this.createService.execute({
      establishmentOwnerId: user.userId,
      serviceName,
      description,
      ...(categoryId !== undefined ? { categoryId } : {}),
      estimatedDuration,
      ...(price !== undefined ? { price } : {}),
      ...(priceSpecification !== undefined ? { priceSpecification } : {}),
      isActive,
    });

    if (result.isLeft()) {
      const error = result.value;
      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case InvalidServiceUpdateInputError:
          throw new BadRequestException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new BadRequestException(error.message);
      }
    }
    return {
      service: ServicePresenter.toHTTP(result.value.service),
    };
  }
}
