import {
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
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
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { ListEstablishmentServicesUseCase } from "../../../modules/application/use-cases/service/list-establishment-services";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import type { ServiceFilters } from "../../../modules/application/repositories/services-repository";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ListServicesResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { ServicePresenter } from "../presenters/service-presenter";

const establishmentIdParamSchema = z.uuid();

const listServicesQuerySchema = z.object({
  name: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  size: z.coerce.number().int().positive().optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      return value === "true";
    }),
});

type ListServicesQuerySchema = z.infer<typeof listServicesQuerySchema>;

function buildServiceFiltersFromQuery(
  query: ListServicesQuerySchema,
): ServiceFilters {
  return {
    ...(query.page !== undefined ? { page: query.page } : {}),
    ...(query.size !== undefined ? { size: query.size } : {}),
    ...(query.name !== undefined && query.name.length > 0
      ? { serviceName: query.name }
      : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  };
}

@ApiTags("service")
@ApiBearerAuth("access-token")
@Controller("/establishments/:establishmentId")
@Roles(["ESTABLISHMENT"])
export class ListEstablishmentServicesController {
  constructor(
    private readonly listEstablishmentServices: ListEstablishmentServicesUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List services for a specific establishment (owner only).",
    description:
      "Returns paginated services for the establishment id in the path when it matches the authenticated establishment owner. Omit query param isActive to include active and inactive services.",
  })
  @ApiParam({ name: "establishmentId", format: "uuid" })
  @ApiQuery({
    name: "name",
    required: false,
    type: String,
    description: "Case-insensitive partial match on service name.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default 1).",
  })
  @ApiQuery({
    name: "size",
    required: false,
    type: Number,
    description: "Page size (default 20).",
  })
  @ApiQuery({
    name: "isActive",
    required: false,
    enum: ["true", "false"],
    description:
      "When set, filters by active flag. Omit to return both active and inactive services.",
  })
  @ApiOkResponse({
    description: "Services listed successfully.",
    type: ListServicesResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid query parameters." })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description:
      "Authenticated user is not the owner of the establishment in the path.",
  })
  @ApiNotFoundResponse({
    description:
      "Establishment profile for the authenticated owner was not found.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while listing services.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("establishmentId", new ZodValidationPipe(establishmentIdParamSchema))
    establishmentId: string,
    @Query(new ZodValidationPipe(listServicesQuerySchema))
    query: ListServicesQuerySchema,
  ) {
    const result = await this.listEstablishmentServices.execute({
      establishmentOwnerId: user.userId,
      establishmentId,
      filters: buildServiceFiltersFromQuery(query),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case NotAllowedError:
          throw new ForbiddenException(error.message);
        default:
          throw new InternalServerErrorException(
            error instanceof Error ? error.message : "Unexpected error.",
          );
      }
    }

    return {
      items: result.value.items.map((service) =>
        ServicePresenter.toHTTP(service),
      ),
      totalItems: result.value.totalItems,
    };
  }
}
