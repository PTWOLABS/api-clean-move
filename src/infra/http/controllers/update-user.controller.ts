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
import { GetMeUseCase } from "../../../modules/application/use-cases/user/get-me";
import { UpdateUserUseCase } from "../../../modules/application/use-cases/user/update-user";
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
  })
  .strict()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "At least one field must be provided for update.",
  });

type UpdateUserBodySchema = z.infer<typeof updateUserBodySchema>;

@ApiTags("user")
@ApiBearerAuth("access-token")
@Controller("user")
export class UpdateUserController {
  constructor(
    private readonly updateUser: UpdateUserUseCase,
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
    description: "Invalid request payload or empty update body.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiNotFoundResponse({ description: "User not found." })
  @ApiConflictResponse({
    description: "Email already in use.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while updating the user.",
  })
  async handle(
    @CurrentUser() authenticatedUser: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateUserBodySchema))
    body: UpdateUserBodySchema,
  ) {
    const userResult = await this.updateUser.execute({
      userId: authenticatedUser.userId,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
    });

    if (userResult.isLeft()) {
      this.mapUserError(userResult.value);
    }

    const getMeResult = await this.getMe.execute({
      userId: authenticatedUser.userId,
    });

    if (getMeResult.isLeft()) {
      this.mapUserError(getMeResult.value);
    }

    return {
      user: UserPresenter.toHTTP(getMeResult.value.user, {
        establishmentId: getMeResult.value.establishmentId,
      }),
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
}
