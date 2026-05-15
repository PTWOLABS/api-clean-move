import { Injectable } from "@nestjs/common";
import { User } from "../../accounts/domain/entities/user";
import { Session } from "../../accounts/domain/entities/session";
import { Either, left, right } from "../../../shared/either";
import { InvalidCredentialsError } from "../../../shared/errors/invalid-credentials-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { SessionsRepository } from "../repositories/sessions-repository";
import { SessionCreationService } from "../../accounts/domain/services/session-creation-service";
import { InvalidSessionCreationError } from "../../accounts/domain/errors/invalid-session-creation-error";
import { EnvService } from "../../../infra/env/env.service";
import { AuthService } from "../../../infra/auth/auth.service";
import { UniqueEntityId } from "../../../shared/entities/unique-entity-id";
import { TokenHasher } from "../repositories/token-hasher";
import { EmployeeSessionAccessService } from "./employee-session-access";

type CreateAuthSessionRequest = {
  user: User;
  userAgent?: string | null | undefined;
  ipAddress?: string | null | undefined;
  referenceDate?: Date | undefined;
};

type CreateAuthSessionResponse = Either<
  InvalidCredentialsError | InvalidSessionCreationError | UnexpectedDomainError,
  { session: Session; refreshToken: string; accessToken: string }
>;

@Injectable()
export class AuthSessionService {
  constructor(
    private sessionsRepository: SessionsRepository,
    private tokenHasher: TokenHasher,
    private sessionCreationService: SessionCreationService,
    private envService: EnvService,
    private authService: AuthService,
    private employeeSessionAccess: EmployeeSessionAccessService,
  ) {}

  async create({
    user,
    userAgent,
    ipAddress,
    referenceDate = new Date(),
  }: CreateAuthSessionRequest): Promise<CreateAuthSessionResponse> {
    const canCreateSession =
      await this.employeeSessionAccess.canCreateSessionFor({
        userId: user.id.toString(),
        role: user.role,
      });

    if (!canCreateSession) {
      return left(new InvalidCredentialsError());
    }

    try {
      const refreshTokenTtlInMs = this.envService.get(
        "REFRESH_TOKEN_TTL_IN_MS",
      );
      const sessionId = new UniqueEntityId();

      const refreshToken = await this.authService.generateRefreshToken({
        sub: user.id.toString(),
        sid: sessionId.toString(),
      });
      const refreshTokenHash = await this.tokenHasher.hash(refreshToken);

      const session = this.sessionCreationService.execute({
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        ttlInMs: refreshTokenTtlInMs,
        referenceDate,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      });

      const accessToken = await this.authService.generateAccessToken({
        sub: user.id.toString(),
        role: user.role,
        sid: sessionId.toString(),
      });

      await this.sessionsRepository.create(session);

      return right({ session, refreshToken, accessToken });
    } catch (error) {
      if (error instanceof InvalidSessionCreationError) {
        return left(new InvalidSessionCreationError(error.message));
      }

      return left(new UnexpectedDomainError());
    }
  }
}
