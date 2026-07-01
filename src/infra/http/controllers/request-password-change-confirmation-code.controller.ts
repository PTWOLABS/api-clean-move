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

import { RequestPasswordChangeConfirmationCodeUseCase } from "../../../modules/application/use-cases/user/request-password-change-confirmation-code";
import { InvalidUserPasswordUpdateInputError } from "../../../shared/errors/invalid-user-password-update-input-error";
import { InvalidCurrentPasswordError } from "../../../shared/errors/invalid-current-password-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { SamePasswordError } from "../../../shared/errors/same-password-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { AuthMessageResponseDto } from "../docs/auth-swagger.dto";
import { RequestPasswordChangeConfirmationCodeBodyDto } from "../docs/user-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const requestPasswordChangeConfirmationCodeBodySchema = z.object({
  newPassword: z.string().min(8).max(72),
  currentPassword: z.string().min(1).max(72).optional(),
});

type RequestPasswordChangeConfirmationCodeBodySchema = z.infer<
  typeof requestPasswordChangeConfirmationCodeBodySchema
>;

const confirmationCodeSentMessage =
  "We sent a confirmation code to your email.";

@ApiTags("user")
@ApiBearerAuth("access-token")
@Controller("user")
export class RequestPasswordChangeConfirmationCodeController {
  constructor(
    private readonly requestPasswordChangeConfirmationCode: RequestPasswordChangeConfirmationCodeUseCase,
  ) {}

  @Post("me/password/confirmation-code")
  @HttpCode(200)
  @Throttle({ default: authPasswordFlowThrottle.request })
  @ApiOperation({
    summary: "Request a confirmation code to change the local password.",
    description:
      "Step 1 of the logged-in password change flow. Validates the new password, stores a pending password hash, and sends a six-digit OTP to the user's email. The same newPassword value must be sent again in step 2 (POST /user/me/password).",
  })
  @ApiBody({ type: RequestPasswordChangeConfirmationCodeBodyDto })
  @ApiOkResponse({
    description: "Confirmation code sent to the authenticated user's email.",
    type: AuthMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid password update payload, incorrect current password, or same password.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiNotFoundResponse({ description: "User not found." })
  async handle(
    @CurrentUser() authenticatedUser: AuthenticatedUser,
    @Body(
      new ZodValidationPipe(requestPasswordChangeConfirmationCodeBodySchema),
    )
    body: RequestPasswordChangeConfirmationCodeBodySchema,
  ) {
    const result = await this.requestPasswordChangeConfirmationCode.execute({
      userId: authenticatedUser.userId,
      newPassword: body.newPassword,
      ...(body.currentPassword !== undefined
        ? { currentPassword: body.currentPassword }
        : {}),
    });

    if (result.isLeft()) {
      this.mapError(result.value);
    }

    return { message: confirmationCodeSentMessage };
  }

  private mapError(
    error:
      | ResourceNotFoundError
      | InvalidUserPasswordUpdateInputError
      | InvalidCurrentPasswordError
      | SamePasswordError,
  ): never {
    if (error instanceof ResourceNotFoundError) {
      throw new NotFoundException(error.message);
    }

    if (
      error instanceof InvalidCurrentPasswordError ||
      error instanceof SamePasswordError
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
