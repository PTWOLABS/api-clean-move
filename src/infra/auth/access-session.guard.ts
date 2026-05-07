import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "../../modules/accounts/domain/value-objects/user-role";
import { SessionsRepository } from "../../modules/application/repositories/sessions-repository";
import { EmployeeSessionAccessService } from "../../modules/application/services/employee-session-access";
import { AuthenticatedRequest } from "./authenticated-user";
import { AuthService } from "./auth.service";
import { IS_PUBLIC_KEY } from "./public";

@Injectable()
export class AccessSessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsRepository: SessionsRepository,
    private readonly reflector: Reflector,
    private readonly employeeSessionAccess: EmployeeSessionAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("Missing access token.");
    }

    try {
      const payload = await this.authService.verifyAccessToken(token);
      const session = await this.sessionsRepository.findById(payload.sid);

      if (
        !session ||
        session.userId.toString() !== payload.sub ||
        session.isRevoked() ||
        session.isExpired()
      ) {
        throw new UnauthorizedException("Invalid or expired session.");
      }

      const role = payload.role as UserRole;
      const canReadSession = await this.employeeSessionAccess.canReadSessionFor(
        {
          userId: payload.sub,
          role,
        },
      );

      if (!canReadSession) {
        throw new UnauthorizedException("Invalid or expired session.");
      }

      request.user = {
        userId: payload.sub,
        sessionId: payload.sid,
        role,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Invalid access token.");
    }
  }

  private extractTokenFromHeader(
    request: AuthenticatedRequest,
  ): string | undefined {
    const authorizationHeader = request.headers.authorization;
    const authorization = Array.isArray(authorizationHeader)
      ? authorizationHeader[0]
      : authorizationHeader;
    const [type, token] = authorization?.split(" ") ?? [];

    return type === "Bearer" ? token : undefined;
  }
}
