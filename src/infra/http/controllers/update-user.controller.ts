import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Patch,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";
import { UpdateEstablishmentUseCase } from "../../../modules/application/use-cases/establishment/update-establishment";
import { GetMeUseCase } from "../../../modules/application/use-cases/user/get-me";
import { UpdateUserUseCase } from "../../../modules/application/use-cases/user/update-user";
import { InvalidUpdateEstablishmentInputError } from "../../../modules/establishments/domain/errors/invalid-update-establishment-input-error";
import { InvalidUserUpdateInputError } from "../../../modules/application/use-cases/user/update-user";
import { ResourceAlreadyExistsError } from "../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import {
  UpdateUserBodyDto,
  UpdateUserResponseDto,
} from "../docs/user-swagger.dto";
import { UserPresenter } from "../presenters/user-presenter";

const updateUserAddressSchema = z
  .object({
    street: z.string().trim().min(1),
    complement: z.string().trim().optional().nullable(),
    country: z.string().trim().min(1),
    state: z.string().trim().min(1),
    zipCode: z.string().trim().min(1),
    city: z.string().trim().min(1),
  })
  .strict();

const updateUserBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.email().optional(),
    phone: z.string().trim().min(1).optional(),
    address: updateUserAddressSchema.optional(),
    establishment: z
      .object({
        tradeName: z.string().trim().min(1).optional(),
        legalBusinessName: z.string().trim().min(1).optional(),
        cnpj: z.string().trim().min(1).optional(),
        slug: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (body) => {
      const { establishment, ...userFields } = body;
      const hasUserField = Object.values(userFields).some(
        (value) => value !== undefined,
      );
      const hasEstablishmentField =
        establishment !== undefined &&
        Object.values(establishment).some((value) => value !== undefined);

      return hasUserField || hasEstablishmentField;
    },
    { message: "At least one field must be provided for update." },
  );

type UpdateUserBodySchema = z.infer<typeof updateUserBodySchema>;

@ApiTags("user")
@ApiBearerAuth("access-token")
@Controller("user")
export class UpdateUserController {
  constructor(
    private readonly updateUser: UpdateUserUseCase,
    private readonly updateEstablishment: UpdateEstablishmentUseCase,
    private readonly getMe: GetMeUseCase,
  ) {}

  @Patch("me")
  @HttpCode(200)
  @ApiOperation({ summary: "Update the authenticated user profile." })
  @ApiBody({ type: UpdateUserBodyDto })
  @ApiOkResponse({
    description: "Updated user profile.",
    type: UpdateUserResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid request payload, empty update body, or establishment block for non-owners.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiNotFoundResponse({ description: "User or establishment not found." })
  @ApiConflictResponse({
    description: "Email or establishment already in use.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while updating the user.",
  })
  async handle(
    @CurrentUser() authenticatedUser: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateUserBodySchema))
    body: UpdateUserBodySchema,
  ) {
    const { establishment, ...userFields } = body;

    if (
      establishment !== undefined &&
      authenticatedUser.role !== "ESTABLISHMENT"
    ) {
      throw new BadRequestException(
        "Establishment data can only be updated by establishment owners.",
      );
    }

    const hasUserField = Object.values(userFields).some(
      (value) => value !== undefined,
    );

    if (hasUserField) {
      const userResult = await this.updateUser.execute({
        userId: authenticatedUser.userId,
        ...(userFields.name !== undefined ? { name: userFields.name } : {}),
        ...(userFields.email !== undefined ? { email: userFields.email } : {}),
        ...(userFields.phone !== undefined ? { phone: userFields.phone } : {}),
        ...(userFields.address !== undefined
          ? { address: userFields.address }
          : {}),
      });

      if (userResult.isLeft()) {
        this.mapUserError(userResult.value);
      }
    }

    if (establishment !== undefined) {
      const establishmentResult = await this.updateEstablishment.execute({
        ownerId: authenticatedUser.userId,
        ...(establishment.tradeName !== undefined
          ? { tradeName: establishment.tradeName }
          : {}),
        ...(establishment.legalBusinessName !== undefined
          ? { legalBusinessName: establishment.legalBusinessName }
          : {}),
        ...(establishment.cnpj !== undefined
          ? { cnpj: establishment.cnpj }
          : {}),
        ...(establishment.slug !== undefined
          ? { slug: establishment.slug }
          : {}),
      });

      if (establishmentResult.isLeft()) {
        this.mapEstablishmentError(establishmentResult.value);
      }
    }

    const getMeResult = await this.getMe.execute({
      userId: authenticatedUser.userId,
    });

    if (getMeResult.isLeft()) {
      this.mapUserError(getMeResult.value);
    }

    return {
      user: UserPresenter.toHTTP(getMeResult.value.user),
    };
  }

  private mapUserError(
    error:
      | ResourceNotFoundError
      | ResourceAlreadyExistsError
      | InvalidUserUpdateInputError
      | UnexpectedDomainError,
  ): never {
    if (error instanceof ResourceNotFoundError) {
      throw new NotFoundException(error.message);
    }

    if (error instanceof ResourceAlreadyExistsError) {
      throw new ConflictException(error.message);
    }

    if (error instanceof InvalidUserUpdateInputError) {
      throw new BadRequestException(error.message);
    }

    throw new InternalServerErrorException(error.message);
  }

  private mapEstablishmentError(
    error:
      | ResourceNotFoundError
      | ResourceAlreadyExistsError
      | InvalidUpdateEstablishmentInputError
      | UnexpectedDomainError,
  ): never {
    if (error instanceof ResourceNotFoundError) {
      throw new NotFoundException(error.message);
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
