import {
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
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
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { GetEstablishmentUseCase } from "../../../modules/application/use-cases/establishment/get-establishment";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { GetEstablishmentResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { EstablishmentPresenter } from "../presenters/establishment-presenter";

const establishmentIdParamSchema = z.uuid();

@ApiTags("establishment")
@ApiBearerAuth("access-token")
@Controller("/establishments/:establishmentId")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
export class GetEstablishmentController {
  constructor(private readonly getEstablishment: GetEstablishmentUseCase) {}

  @Get()
  @ApiOperation({ summary: "Get establishment commercial profile by id." })
  @ApiParam({ name: "establishmentId", format: "uuid" })
  @ApiOkResponse({
    description: "Establishment commercial profile.",
    type: GetEstablishmentResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid establishment id." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({ description: "Operation not allowed." })
  @ApiNotFoundResponse({ description: "Establishment not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("establishmentId", new ZodValidationPipe(establishmentIdParamSchema))
    establishmentId: string,
  ) {
    const result = await this.getEstablishment.execute({
      actor: {
        userId: user.userId,
        role: user.role,
      },
      establishmentId,
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
          throw new InternalServerErrorException(error.message);
      }
    }

    return {
      establishment: EstablishmentPresenter.toHTTP(result.value.establishment),
    };
  }
}
