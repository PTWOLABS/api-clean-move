import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import z from "zod";

import { ListAllServicesUseCase } from "../../../modules/application/use-cases/service/list-all-services";
import type { ServiceFilters } from "../../../modules/application/repositories/services-repository";
import { Public } from "../../auth/public";
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
@Controller("/services")
@Public()
export class ListAllServicesController {
  constructor(private readonly listAllServices: ListAllServicesUseCase) {}

  @Get()
  @ApiOperation({
    summary: "List all services (paginated).",
    description:
      "Public catalog listing across establishments. Omit query param isActive to include active and inactive services.",
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
  async handle(
    @Query(new ZodValidationPipe(listServicesQuerySchema))
    query: ListServicesQuerySchema,
  ) {
    const { items, totalItems } = await this.listAllServices.execute({
      filters: buildServiceFiltersFromQuery(query),
    });

    return {
      items: items.map((service) => ServicePresenter.toHTTP(service)),
      totalItems,
    };
  }
}
