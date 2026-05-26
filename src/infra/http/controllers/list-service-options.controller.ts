import {
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { ListServiceOptionsUseCase } from "../../../modules/application/use-cases/service/list-service-options";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { EmployeeFeatures } from "../../auth/employee-features";
import { Roles } from "../../auth/roles";
import { ServiceOptionsResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const listServiceOptionsQuerySchema = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

type ListServiceOptionsQuerySchema = z.infer<
  typeof listServiceOptionsQuerySchema
>;

@ApiTags("service")
@ApiBearerAuth("access-token")
@Controller("/services/options")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["read:services"])
export class ListServiceOptionsController {
  constructor(private readonly listServiceOptions: ListServiceOptionsUseCase) {}

  @Get()
  @ApiOperation({
    summary: "List service options for the authenticated establishment.",
    description:
      "Returns active service options with only id and label. The optional search term is applied only to service name.",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search by service name.",
    example: "Lavagem",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Positive maximum number of options. Defaults to 20.",
    example: 20,
  })
  @ApiOkResponse({
    description: "Service options listed successfully.",
    type: ServiceOptionsResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid query parameters.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description:
      "Authenticated user does not have the required role or employee feature.",
  })
  @ApiNotFoundResponse({
    description:
      "The authenticated establishment user does not have an establishment profile.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while listing service options.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listServiceOptionsQuerySchema))
    query: ListServiceOptionsQuerySchema,
  ) {
    const result = await this.listServiceOptions.execute({
      actor: {
        userId: user.userId,
        role: user.role,
      },
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case NotAllowedError:
          throw new ForbiddenException(error.message);
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        default:
          throw new InternalServerErrorException(error.message);
      }
    }

    return {
      services: result.value.services,
    };
  }
}
