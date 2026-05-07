import { Injectable } from "@nestjs/common";
import { Session } from "../../../accounts/domain/entities/session";
import { User } from "../../../accounts/domain/entities/user";
import { Either, left, right } from "../../../../shared/either";
import { InvalidSessionError } from "../../../../shared/errors/invalid-session-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { AuthService } from "../../../../infra/auth/auth.service";
import { EnvService } from "../../../../infra/env/env.service";
import { SessionsRepository } from "../../repositories/sessions-repository";
import { TokenHasher } from "../../repositories/token-hasher";
import { UsersRepository } from "../../repositories/users-repository";
import { EmployeeSessionAccessService } from "../../services/employee-session-access";

type RefreshSessionUseCaseRequest = {
  refreshToken: string;
};

type RefreshSessionUseCaseResponse = Either<
  InvalidSessionError | UnexpectedDomainError,
  {
    user: User;
    session: Session;
    accessToken: string;
    refreshToken: string;
  }
>;

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    private readonly authService: AuthService,
    private readonly envService: EnvService,
    private readonly sessionsRepository: SessionsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly tokenHasher: TokenHasher,
    private readonly employeeSessionAccess: EmployeeSessionAccessService,
  ) {}

  async execute({
    refreshToken,
  }: RefreshSessionUseCaseRequest): Promise<RefreshSessionUseCaseResponse> {
    let payload;

    try {
      payload = await this.authService.verifyRefreshToken(refreshToken);
    } catch {
      return left(new InvalidSessionError());
    }

    try {
      const session = await this.sessionsRepository.findById(payload.sid);

      if (
        !session ||
        session.userId.toString() !== payload.sub ||
        session.isRevoked() ||
        session.isExpired()
      ) {
        return left(new InvalidSessionError());
      }

      const refreshTokenHash = await this.tokenHasher.hash(refreshToken);
      const refreshTokenMatches = refreshTokenHash === session.refreshTokenHash;

      if (!refreshTokenMatches) {
        return left(new InvalidSessionError());
      }

      const user = await this.usersRepository.findById(payload.sub);

      if (!user) {
        return left(new InvalidSessionError());
      }

      const canReadSession = await this.employeeSessionAccess.canReadSessionFor(
        {
          userId: user.id.toString(),
          role: user.role,
        },
      );

      if (!canReadSession) {
        return left(new InvalidSessionError());
      }

      const newRefreshToken = await this.authService.generateRefreshToken({
        sub: user.id.toString(),
        sid: session.id.toString(),
      });
      const newRefreshTokenHash = await this.tokenHasher.hash(newRefreshToken);
      const referenceDate = new Date();
      const nextExpiration = new Date(
        referenceDate.getTime() +
          this.envService.get("REFRESH_TOKEN_TTL_IN_MS"),
      );

      session.rotateToken(newRefreshTokenHash, nextExpiration, referenceDate);

      await this.sessionsRepository.save(session);

      const accessToken = await this.authService.generateAccessToken({
        sub: user.id.toString(),
        role: user.role,
        sid: session.id.toString(),
      });

      return right({
        user,
        session,
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch {
      return left(new UnexpectedDomainError());
    }
  }
}
