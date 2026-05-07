import { Injectable } from "@nestjs/common";
import { User } from "../../../accounts/domain/entities/user";
import { Either, left, right } from "../../../../shared/either";
import { InvalidCredentialsError } from "../../../../shared/errors/invalid-credentials-error";
import { HashComparer } from "../../repositories/hash-comparer";
import { UsersRepository } from "../../repositories/users-repository";
import {
  Email,
  InvalidEmailError,
} from "../../../accounts/domain/value-objects/email";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { SessionsRepository } from "../../repositories/sessions-repository";
import { SessionCreationService } from "../../../accounts/domain/services/session-creation-service";
import { Session } from "../../../accounts/domain/entities/session";
import { InvalidSessionCreationError } from "../../../accounts/domain/errors/invalid-session-creation-error";
import { EnvService } from "../../../../infra/env/env.service";
import { AuthService } from "../../../../infra/auth/auth.service";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { TokenHasher } from "../../repositories/token-hasher";
import { EmployeeSessionAccessService } from "../../services/employee-session-access";

type LoginWithCredentialsUseCaseRequest = {
  email: string;
  password: string;
  userAgent?: string | null;
  ipAddress?: string | null;
};

type LoginWithCredentialsUseCaseResponse = Either<
  InvalidCredentialsError | UnexpectedDomainError | InvalidSessionCreationError,
  { user: User; session: Session; refreshToken: string; accessToken: string }
>;

@Injectable()
export class LoginWithCredentialsUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private sessionsRepository: SessionsRepository,
    private hashComparer: HashComparer,
    private tokenHasher: TokenHasher,
    private sessionCreationService: SessionCreationService,
    private envService: EnvService,
    private authService: AuthService,
    private employeeSessionAccess: EmployeeSessionAccessService,
  ) {}

  async execute({
    email: rawEmail,
    password,
    userAgent,
    ipAddress,
  }: LoginWithCredentialsUseCaseRequest): Promise<LoginWithCredentialsUseCaseResponse> {
    let email: Email;

    try {
      email = new Email(rawEmail);
    } catch (error) {
      if (error instanceof InvalidEmailError) {
        return left(new InvalidCredentialsError(error.message));
      }

      return left(new UnexpectedDomainError());
    }

    const user = await this.usersRepository.findByEmail(email.toString());

    if (!user || user.hashedPassword === null) {
      return left(new InvalidCredentialsError());
    }

    const passwordMatches = await this.hashComparer.compare(
      password,
      user.hashedPassword,
    );

    if (!passwordMatches) {
      return left(new InvalidCredentialsError());
    }

    const canCreateSession =
      await this.employeeSessionAccess.canCreateSessionFor({
        userId: user.id.toString(),
        role: user.role,
      });

    if (!canCreateSession) {
      return left(new InvalidCredentialsError());
    }

    const referenceDate = new Date();

    let session;
    let accessToken;
    let refreshToken;

    try {
      const refreshTokenTtlInMs = this.envService.get(
        "REFRESH_TOKEN_TTL_IN_MS",
      );
      const sessionId = new UniqueEntityId();

      refreshToken = await this.authService.generateRefreshToken({
        sub: user.id.toString(),
        sid: sessionId.toString(),
      });
      const refreshTokenHash = await this.tokenHasher.hash(refreshToken);

      session = this.sessionCreationService.execute({
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        ttlInMs: refreshTokenTtlInMs,
        referenceDate,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      });

      accessToken = await this.authService.generateAccessToken({
        sub: user.id.toString(),
        role: user.role,
        sid: sessionId.toString(),
      });

      await this.sessionsRepository.create(session);
    } catch (error) {
      if (error instanceof InvalidSessionCreationError) {
        return left(new InvalidSessionCreationError(error.message));
      }

      return left(new UnexpectedDomainError());
    }

    return right({ user, session, refreshToken, accessToken });
  }
}
