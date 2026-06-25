import { Body, Controller, Post, Req, UsePipes } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import z from "zod";

import { RequestPasswordResetUseCase } from "../../../modules/application/use-cases/auth/request-password-reset";
import { Public } from "../../auth/public";
import {
  resolveIpAddress,
  resolveUserAgent,
} from "../helpers/resolve-request-metadata";
import {
  AuthMessageResponseDto,
  RequestPasswordResetBodyDto,
} from "../docs/auth-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const requestPasswordResetBodySchema = z.object({
  email: z.email().trim(),
});

type RequestPasswordResetBodySchema = z.infer<
  typeof requestPasswordResetBodySchema
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
export class RequestPasswordResetController {
  constructor(
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
  ) {}

  @Post("request")
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @UsePipes(new ZodValidationPipe(requestPasswordResetBodySchema))
  @ApiOperation({
    summary: "Request a password reset link by email.",
  })
  @ApiBody({ type: RequestPasswordResetBodyDto })
  @ApiOkResponse({
    description:
      "Generic success response regardless of whether the email is registered.",
    type: AuthMessageResponseDto,
  })
  async handle(
    @Body() body: RequestPasswordResetBodySchema,
    @Req() req: RequestLike,
  ) {
    await this.requestPasswordReset.execute({
      email: body.email,
      ipAddress: resolveIpAddress(req),
      userAgent: resolveUserAgent(req),
    });

    return {
      message:
        "If an account exists for this email, we will send a password reset link.",
    };
  }
}
