import {
  Controller,
  Delete,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
  Param,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { DeleteServiceUseCase } from "../../../modules/application/use-cases/service/delete-service";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const serviceIdParamSchema = z.uuid();

@ApiTags("service")
@ApiBearerAuth("access-token")
@Controller("/services/:serviceId")
@Roles(["ESTABLISHMENT"])
export class DeleteServiceController {
  constructor(private readonly deleteService: DeleteServiceUseCase) {}

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary: "Soft-delete a service for the authenticated establishment.",
    description:
      "Sets deleted_at on the service. Deleted services are omitted from listings and cannot be used for new appointments. Historical appointments keep their snapshot.",
  })
  @ApiParam({
    name: "serviceId",
    description: "Service identifier.",
    format: "uuid",
  })
  @ApiNoContentResponse({ description: "Service deleted successfully." })
  @ApiBadRequestResponse({
    description: "Invalid service id.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description: "Service does not belong to the authenticated establishment.",
  })
  @ApiNotFoundResponse({
    description:
      "Establishment profile, service was not found, or the service was already deleted.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while deleting the service.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("serviceId", new ZodValidationPipe(serviceIdParamSchema))
    serviceId: string,
  ) {
    const result = await this.deleteService.execute({
      establishmentOwnerId: user.userId,
      serviceId,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case NotAllowedError:
          throw new ForbiddenException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new InternalServerErrorException(
            error instanceof Error ? error.message : "Unexpected error.",
          );
      }
    }
  }
}
