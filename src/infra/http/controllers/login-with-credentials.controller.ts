import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  InternalServerErrorException,
  Post,
  Req,
  Res,
  UsePipes,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import z from "zod";
import { Public } from "../../auth/public";
import {
  CookieResponseLike,
  RefreshTokenCookieService,
} from "../../auth/refresh-token-cookie.service";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { LoginWithCredentialsUseCase } from "../../../modules/application/use-cases/auth/login-with-credentials";
import { InvalidCredentialsError } from "../../../shared/errors/invalid-credentials-error";
import {
  AuthWithOnboardingResponseDto,
  LoginWithCredentialsBodyDto,
} from "../docs/auth-swagger.dto";
import { EstablishmentsRepository } from "../../../modules/application/repositories/establishment-repository";

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket: {
    remoteAddress?: string | null;
  };
};

const loginWithCredentialsBodySchema = z.object({
  email: z.email().trim(),
  password: z.string().nonempty().max(72),
});

type LoginWithCredentialsBodySchema = z.infer<
  typeof loginWithCredentialsBodySchema
>;

@ApiTags("auth")
@Controller("/auth")
@Public()
export class LoginWithCredentialsController {
  constructor(
    private readonly loginWithCredentials: LoginWithCredentialsUseCase,
    private readonly refreshTokenCookieService: RefreshTokenCookieService,
    private readonly establishmentsRepository: EstablishmentsRepository,
  ) {}

  private getUserAgent(req: RequestLike): string | null {
    const userAgent = req.headers["user-agent"];

    if (typeof userAgent !== "string") {
      return null;
    }

    return userAgent.trim() || null;
  }

  private getIpAddress(req: RequestLike): string | null {
    const forwardedForHeader = req.headers["x-forwarded-for"];
    const forwardedFor = Array.isArray(forwardedForHeader)
      ? forwardedForHeader[0]
      : forwardedForHeader;

    if (typeof forwardedFor === "string") {
      const firstForwardedIp = forwardedFor.split(",")[0]?.trim();

      if (firstForwardedIp) {
        return firstForwardedIp;
      }
    }

    if (req.ip?.trim()) {
      return req.ip.trim();
    }

    return req.socket.remoteAddress?.trim() || null;
  }

  @Post("login")
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(loginWithCredentialsBodySchema))
  @ApiOperation({ summary: "Authenticate with email and password." })
  @ApiBody({ type: LoginWithCredentialsBodyDto })
  @ApiOkResponse({
    description:
      "Authenticated successfully and sets the refresh token cookie.",
    type: AuthWithOnboardingResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid credentials or invalid request payload.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected authentication failure.",
  })
  async handle(
    @Body() body: LoginWithCredentialsBodySchema,
    @Req() req: RequestLike,
    @Res({ passthrough: true }) res: CookieResponseLike,
  ) {
    const result = await this.loginWithCredentials.execute({
      ...body,
      userAgent: this.getUserAgent(req),
      ipAddress: this.getIpAddress(req),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case InvalidCredentialsError:
          throw new BadRequestException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new BadRequestException(error.message);
      }
    }

    this.refreshTokenCookieService.set(res, result.value.refreshToken);

    const establishment = await this.establishmentsRepository.findByOwnerId(
      result.value.user.id.toString(),
    );

    return {
      userId: result.value.user.id.toString(),
      accessToken: result.value.accessToken,
      onboardingCompletedAt:
        establishment?.onboardingCompletedAt?.toISOString() ?? null,
    };
  }
}
