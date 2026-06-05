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
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { ListEstablishmentServicesUseCase } from "../../../modules/application/use-cases/service/list-establishment-services";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import type { ServiceFilters } from "../../../modules/application/repositories/services-repository";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ListServicesResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { ServicePresenter } from "../presenters/service-presenter";

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
@Controller("/services/backoffice")
@Roles(["ESTABLISHMENT"])
export class ListEstablishmentServicesController {
  constructor(
    private readonly listEstablishmentServices: ListEstablishmentServicesUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List services for the authenticated establishment (backoffice).",
    description:
      "Resolves the establishment from the authenticated owner user id and returns its services. Omit query param isActive to include active and inactive services.",
  })
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
  @ApiNotFoundResponse({
    description:
      "No establishment found for the authenticated owner, or resource not found.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while listing services.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listServicesQuerySchema))
    query: ListServicesQuerySchema,
  ) {
    const result = await this.listEstablishmentServices.execute({
      establishmentOwnerId: user.userId,
      filters: buildServiceFiltersFromQuery(query),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
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
