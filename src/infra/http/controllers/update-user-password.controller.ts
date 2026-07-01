import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
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

import { authPasswordFlowThrottle } from "../../auth/auth-password-flow-throttle.config";

import { UpdateUserPasswordUseCase } from "../../../modules/application/use-cases/user/update-user-password";
import { InvalidUserPasswordUpdateInputError } from "../../../shared/errors/invalid-user-password-update-input-error";
import { InvalidCurrentPasswordError } from "../../../shared/errors/invalid-current-password-error";
import { InvalidPasswordConfirmationCodeError } from "../../../shared/errors/invalid-password-confirmation-code-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { SamePasswordError } from "../../../shared/errors/same-password-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { AuthMessageResponseDto } from "../docs/auth-swagger.dto";
import { UpdateUserPasswordBodyDto } from "../docs/user-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const updateUserPasswordBodySchema = z.object({
  confirmationCode: z.string().regex(/^\d{6}$/),
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
  @Throttle({ default: authPasswordFlowThrottle.confirm })
  @ApiOperation({
    summary:
      "Confirm and apply a local password change using the email confirmation code.",
    description:
      "Step 2 of the logged-in password change flow. Requires confirmationCode (breaking change: no longer optional). newPassword must match the value sent in step 1. After success, all active sessions are revoked.",
  })
  @ApiBody({ type: UpdateUserPasswordBodyDto })
  @ApiOkResponse({
    description: "Password updated successfully.",
    type: AuthMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid password update payload, incorrect current password, invalid confirmation code, or same password.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiNotFoundResponse({ description: "User not found." })
  async handle(
    @CurrentUser() authenticatedUser: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateUserPasswordBodySchema))
    body: UpdateUserPasswordBodySchema,
  ) {
    const result = await this.updateUserPassword.execute({
      userId: authenticatedUser.userId,
      confirmationCode: body.confirmationCode,
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
      | InvalidCurrentPasswordError
      | SamePasswordError
      | InvalidPasswordConfirmationCodeError,
  ): never {
    if (error instanceof ResourceNotFoundError) {
      throw new NotFoundException(error.message);
    }

    if (
      error instanceof InvalidCurrentPasswordError ||
      error instanceof SamePasswordError ||
      error instanceof InvalidPasswordConfirmationCodeError
    ) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        error: "Bad Request",
        message: error.message,
        code: error.code,
        field: error.field,
      });
    }

    throw new BadRequestException(error.message);
  }
}
