import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  InternalServerErrorException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UsePipes,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";
import {
  Email,
  InvalidEmailError,
} from "../../../modules/accounts/domain/value-objects/email";
import { AuthenticateWithOAuthUseCase } from "../../../modules/application/use-cases/auth/authenticate-with-oauth";
import { AuthSessionService } from "../../../modules/application/services/auth-session.service";
import { OAuthEmailNotVerifiedError } from "../../../shared/errors/oauth-email-not-verified-error";
import { InvalidCredentialsError } from "../../../shared/errors/invalid-credentials-error";
import { InvalidSessionCreationError } from "../../../modules/accounts/domain/errors/invalid-session-creation-error";
import { Public } from "../../auth/public";
import { OAuthIdTokenVerifier } from "../../../modules/application/services/oauth-id-token-verifier";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import {
  AuthenticateWithGoogleBodyDto,
  AuthSuccessResponseDto,
} from "../docs/auth-swagger.dto";
import {
  CookieResponseLike,
  RefreshTokenCookieService,
} from "../../auth/refresh-token-cookie.service";

const authenticateWithGoogleBodySchema = z.object({
  idToken: z.string().trim().min(1),
});

type AuthenticateWithGoogleBodySchema = z.infer<
  typeof authenticateWithGoogleBodySchema
>;

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket: {
    remoteAddress?: string | null;
  };
};

@ApiTags("auth")
@Controller("/auth/google")
@Public()
export class AuthenticateWithGoogleController {
  constructor(
    private readonly authenticateWithOAuth: AuthenticateWithOAuthUseCase,
    private readonly oauthIdTokenVerifier: OAuthIdTokenVerifier,
    private readonly authSessionService: AuthSessionService,
    private readonly refreshTokenCookieService: RefreshTokenCookieService,
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

  @Post()
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(authenticateWithGoogleBodySchema))
  @ApiOperation({ summary: "Authenticate with a Google ID token." })
  @ApiBody({ type: AuthenticateWithGoogleBodyDto })
  @ApiOkResponse({
    description:
      "Authenticated successfully with Google and sets the refresh token cookie.",
    type: AuthSuccessResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid request payload or unverified Google email.",
  })
  @ApiUnauthorizedResponse({
    description: "Invalid or expired Google ID token.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected OAuth authentication failure.",
  })
  async handle(
    @Body() body: AuthenticateWithGoogleBodySchema,
    @Req() req: RequestLike,
    @Res({ passthrough: true }) res: CookieResponseLike,
  ) {
    const { idToken } = body;

    let claims;

    try {
      claims = await this.oauthIdTokenVerifier.verifyGoogleIdToken(idToken);
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error ? error.message : "Invalid OAuth token.",
      );
    }

    let email: Email;

    try {
      email = new Email(claims.email);
    } catch (error) {
      if (error instanceof InvalidEmailError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException("Failed to parse OAuth email.");
    }

    const result = await this.authenticateWithOAuth.execute({
      provider: claims.provider,
      subjectId: claims.subjectId,
      email,
      emailVerified: claims.emailVerified,
      ...(claims.name ? { name: claims.name } : {}),
    });

    if (result.isLeft()) {
      const error = result.value;

      if (error instanceof OAuthEmailNotVerifiedError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException("OAuth authentication failed.");
    }

    const { user } = result.value;

    const sessionResult = await this.authSessionService.create({
      user,
      userAgent: this.getUserAgent(req),
      ipAddress: this.getIpAddress(req),
    });

    if (sessionResult.isLeft()) {
      const error = sessionResult.value;

      if (error instanceof InvalidCredentialsError) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof InvalidSessionCreationError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException("Google authentication failed.");
    }

    const { refreshToken, accessToken } = sessionResult.value;

    this.refreshTokenCookieService.set(res, refreshToken);

    return {
      accessToken,
      userId: user.id.toString(),
    };
  }
}
