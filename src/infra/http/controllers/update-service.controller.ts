import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
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

import {
  InvalidServiceUpdateInputError,
  UpdateServiceUseCase,
} from "../../../modules/application/use-cases/service/update-service";
import { NoUpdateFieldsProvidedError } from "../../../shared/errors/no-update-field-provided-error";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { ServiceCategory } from "../../../modules/catalog/domain/value-objects/service-category";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  UpdateServiceBodyDto,
  UpdateServiceResponseDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { ServicePresenter } from "../presenters/service-presenter";

const serviceCategories = [
  "WASH",
  "SANITIZATION",
  "AUTOMATIVE_DETAILING",
  "PROTECTION",
  "UPHOLSTERY",
] as const satisfies readonly ServiceCategory[];

const updateServiceBodySchema = z
  .object({
    serviceName: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    category: z.enum(serviceCategories).optional(),
    estimatedDuration: z
      .object({
        minInMinutes: z.coerce.number().int().positive(),
        maxInMinutes: z.coerce.number().int().positive().optional(),
      })
      .optional(),
    price: z.number().positive().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field must be provided.",
  );

type UpdateServiceBodySchema = z.infer<typeof updateServiceBodySchema>;
const serviceIdParamSchema = z.uuid();

@ApiTags("service")
@ApiBearerAuth("access-token")
@Controller("/services/:serviceId")
@Roles(["ESTABLISHMENT"])
export class UpdateServiceController {
  constructor(private readonly updateService: UpdateServiceUseCase) {}

  @Patch()
  @ApiOperation({
    summary: "Update a service for the authenticated establishment.",
    description:
      "Updates one or more service fields. The service must belong to the establishment of the authenticated owner.",
  })
  @ApiParam({
    name: "serviceId",
    description: "Service identifier.",
    format: "uuid",
  })
  @ApiBody({
    type: UpdateServiceBodyDto,
    description: "At least one field must be provided.",
  })
  @ApiOkResponse({
    description: "Service updated successfully.",
    type: UpdateServiceResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, empty update, or invalid field values (name, price, duration, etc.).",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description: "Service does not belong to the authenticated establishment.",
  })
  @ApiNotFoundResponse({
    description: "Establishment profile or service was not found.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while updating the service.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("serviceId", new ZodValidationPipe(serviceIdParamSchema))
    serviceId: string,
    @Body(new ZodValidationPipe(updateServiceBodySchema))
    body: UpdateServiceBodySchema,
  ) {
    const result = await this.updateService.execute({
      establishmentOwnerId: user.userId,
      serviceId,
      data: {
        ...(body.serviceName !== undefined
          ? { serviceName: body.serviceName }
          : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.estimatedDuration !== undefined
          ? { estimatedDuration: body.estimatedDuration }
          : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case NotAllowedError:
          throw new ForbiddenException(error.message);
        case NoUpdateFieldsProvidedError:
          throw new BadRequestException(error.message);
        case InvalidServiceUpdateInputError:
          throw new BadRequestException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new BadRequestException(
            error instanceof Error ? error.message : "Unexpected error.",
          );
      }
    }

    return {
      service: ServicePresenter.toHTTP(result.value.service),
    };
  }
}
