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
import { Session } from "../../../accounts/domain/entities/session";
import { InvalidSessionCreationError } from "../../../accounts/domain/errors/invalid-session-creation-error";
import { CreateAuthSessionUseCase } from "./create-auth-session";

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
    private hashComparer: HashComparer,
    private createAuthSession: CreateAuthSessionUseCase,
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

    const sessionResult = await this.createAuthSession.execute({
      user,
      userAgent,
      ipAddress,
    });

    if (sessionResult.isLeft()) {
      return left(sessionResult.value);
    }

    const { session, refreshToken, accessToken } = sessionResult.value;

    return right({ user, session, refreshToken, accessToken });
  }
}
