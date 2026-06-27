import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  UsePipes,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import z from "zod";

import { UpdateUserPasswordUseCase } from "../../../modules/application/use-cases/user/update-user-password";
import { InvalidUserPasswordUpdateInputError } from "../../../modules/application/use-cases/user/update-user-password";
import { InvalidCurrentPasswordError } from "../../../shared/errors/invalid-current-password-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { AuthMessageResponseDto } from "../docs/auth-swagger.dto";
import { UpdateUserPasswordBodyDto } from "../docs/user-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const updateUserPasswordBodySchema = z.object({
  newPassword: z.string().min(8).max(72),
  currentPassword: z.string().min(1).max(72).optional(),
});

type UpdateUserPasswordBodySchema = z.infer<
  typeof updateUserPasswordBodySchema
>;

@ApiTags("user")
@ApiBearerAuth("access-token")
@Controller("user")
export class UpdateUserPasswordController {
  constructor(private readonly updateUserPassword: UpdateUserPasswordUseCase) {}

  @Post("me/password")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @UsePipes(new ZodValidationPipe(updateUserPasswordBodySchema))
  @ApiOperation({
    summary:
      "Set the first local password or update an existing local password.",
  })
  @ApiBody({ type: UpdateUserPasswordBodyDto })
  @ApiOkResponse({
    description: "Password updated successfully.",
    type: AuthMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid password update payload or incorrect current password.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiNotFoundResponse({ description: "User not found." })
  async handle(
    @CurrentUser() authenticatedUser: AuthenticatedUser,
    @Body() body: UpdateUserPasswordBodySchema,
  ) {
    const result = await this.updateUserPassword.execute({
      userId: authenticatedUser.userId,
      newPassword: body.newPassword,
      ...(body.currentPassword !== undefined
        ? { currentPassword: body.currentPassword }
        : {}),
    });

    if (result.isLeft()) {
      this.mapError(result.value);
    }

    return { message: "Password updated successfully." };
  }

  private mapError(
    error:
      | ResourceNotFoundError
      | InvalidUserPasswordUpdateInputError
      | InvalidCurrentPasswordError,
  ): never {
    if (error instanceof ResourceNotFoundError) {
      throw new NotFoundException(error.message);
    }

    throw new BadRequestException(error.message);
  }
}
