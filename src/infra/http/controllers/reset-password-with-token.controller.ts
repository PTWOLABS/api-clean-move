import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UsePipes,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import z from "zod";

import { ResetPasswordWithTokenUseCase } from "../../../modules/application/use-cases/auth/reset-password-with-token";
import { Public } from "../../auth/public";
import {
  resolveIpAddress,
  resolveUserAgent,
} from "../helpers/resolve-request-metadata";
import {
  AuthMessageResponseDto,
  ResetPasswordWithTokenBodyDto,
} from "../docs/auth-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const resetPasswordWithTokenBodySchema = z.object({
  token: z.string().trim().min(1),
  newPassword: z.string().min(8).max(72),
});

type ResetPasswordWithTokenBodySchema = z.infer<
  typeof resetPasswordWithTokenBodySchema
>;

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket: {
    remoteAddress?: string | null;
  };
};

@ApiTags("auth")
@Controller("/auth/password-reset")
@Public()
export class ResetPasswordWithTokenController {
  constructor(
    private readonly resetPasswordWithToken: ResetPasswordWithTokenUseCase,
  ) {}

  @Post("confirm")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @UsePipes(new ZodValidationPipe(resetPasswordWithTokenBodySchema))
  @ApiOperation({
    summary: "Reset the account password using a valid reset token.",
  })
  @ApiBody({ type: ResetPasswordWithTokenBodyDto })
  @ApiOkResponse({
    description: "Password updated successfully.",
    type: AuthMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid or expired password reset token.",
  })
  async handle(
    @Body() body: ResetPasswordWithTokenBodySchema,
    @Req() req: RequestLike,
  ) {
    const result = await this.resetPasswordWithToken.execute({
      ...body,
      ipAddress: resolveIpAddress(req),
      userAgent: resolveUserAgent(req),
    });

    if (result.isLeft()) {
      throw new BadRequestException(result.value.message);
    }

    return { message: "Password reset successfully." };
  }
}
