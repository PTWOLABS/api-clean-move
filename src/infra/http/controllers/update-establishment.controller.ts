import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
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

import { UpdateEstablishmentUseCase } from "../../../modules/application/use-cases/establishment/update-establishment";
import { InvalidUpdateEstablishmentInputError } from "../../../modules/establishments/domain/errors/invalid-update-establishment-input-error";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceAlreadyExistsError } from "../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  UpdateEstablishmentBodyDto,
  UpdateEstablishmentResponseDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { EstablishmentPresenter } from "../presenters/establishment-presenter";

const establishmentIdParamSchema = z.uuid();

const updateEstablishmentBodySchema = z
  .object({
    tradeName: z.string().trim().min(1).optional(),
    legalBusinessName: z.string().trim().min(1).optional(),
    cnpj: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "At least one field must be provided for update.",
  });

type UpdateEstablishmentBodySchema = z.infer<
  typeof updateEstablishmentBodySchema
>;

@ApiTags("establishment")
@ApiBearerAuth("access-token")
@Controller("/establishments/:establishmentId")
@Roles(["ESTABLISHMENT"])
export class UpdateEstablishmentController {
  constructor(
    private readonly updateEstablishment: UpdateEstablishmentUseCase,
  ) {}

  @Patch()
  @HttpCode(200)
  @ApiOperation({ summary: "Update establishment commercial profile by id." })
  @ApiParam({ name: "establishmentId", format: "uuid" })
  @ApiBody({ type: UpdateEstablishmentBodyDto })
  @ApiOkResponse({
    description: "Updated establishment commercial profile.",
    type: UpdateEstablishmentResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid establishment id, payload, or empty update body.",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({
    description: "Authenticated user is not the establishment owner.",
  })
  @ApiNotFoundResponse({ description: "Establishment not found." })
  @ApiConflictResponse({
    description: "CNPJ or slug already in use.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while updating the establishment.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("establishmentId", new ZodValidationPipe(establishmentIdParamSchema))
    establishmentId: string,
    @Body(new ZodValidationPipe(updateEstablishmentBodySchema))
    body: UpdateEstablishmentBodySchema,
  ) {
    const result = await this.updateEstablishment.execute({
      ownerId: user.userId,
      establishmentId,
      ...(body.tradeName !== undefined ? { tradeName: body.tradeName } : {}),
      ...(body.legalBusinessName !== undefined
        ? { legalBusinessName: body.legalBusinessName }
        : {}),
      ...(body.cnpj !== undefined ? { cnpj: body.cnpj } : {}),
      ...(body.slug !== undefined ? { slug: body.slug } : {}),
    });

    if (result.isLeft()) {
      this.mapError(result.value);
    }

    return {
      establishment: EstablishmentPresenter.toHTTP(result.value.establishment),
    };
  }

  private mapError(
    error:
      | ResourceNotFoundError
      | NotAllowedError
      | ResourceAlreadyExistsError
      | InvalidUpdateEstablishmentInputError
      | UnexpectedDomainError,
  ): never {
    if (error instanceof ResourceNotFoundError) {
      throw new NotFoundException(error.message);
    }

    if (error instanceof NotAllowedError) {
      throw new ForbiddenException(error.message);
    }

    if (error instanceof ResourceAlreadyExistsError) {
      throw new ConflictException(error.message);
    }

    if (error instanceof InvalidUpdateEstablishmentInputError) {
      throw new BadRequestException(error.message);
    }

    throw new InternalServerErrorException(error.message);
  }
}
