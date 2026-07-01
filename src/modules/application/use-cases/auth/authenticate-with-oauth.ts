import { Injectable } from "@nestjs/common";
import { User } from "../../../accounts/domain/entities/user";
import { Email } from "../../../accounts/domain/value-objects/email";
import type { OAuthProvider } from "../../../accounts/domain/value-objects/oauth-provider";
import { UserRole } from "../../../accounts/domain/value-objects/user-role";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import { Either, left, right } from "../../../../shared/either";
import { OAuthEmailMismatchError } from "../../../../shared/errors/oauth-email-mismatch-error";
import { OAuthEmailNotVerifiedError } from "../../../../shared/errors/oauth-email-not-verified-error";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { UnitOfWork } from "../../repositories/unit-of-work";
import { UsersRepository } from "../../repositories/users-repository";

type AuthenticateWithOAuthUseCaseRequest = {
  provider: OAuthProvider;
  subjectId: string;
  email: Email;
  emailVerified: boolean;
  name?: string;
  roleForNewUser?: UserRole;
};

type AuthenticateWithOAuthUseCaseResponse = Either<
  OAuthEmailNotVerifiedError | OAuthEmailMismatchError,
  { user: User }
>;

@Injectable()
export class AuthenticateWithOAuthUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private establishmentsRepository: EstablishmentsRepository,
    private unitOfWork: UnitOfWork,
  ) {}

  async execute({
    provider,
    subjectId,
    email,
    emailVerified,
    name,
    roleForNewUser,
  }: AuthenticateWithOAuthUseCaseRequest): Promise<AuthenticateWithOAuthUseCaseResponse> {
    if (!emailVerified) {
      return left(new OAuthEmailNotVerifiedError());
    }

    const userByLink = await this.usersRepository.findByProviderAndSubject(
      provider,
      subjectId,
    );

    if (userByLink) {
      if (!userByLink.email.equals(email)) {
        return left(new OAuthEmailMismatchError());
      }

      return right({ user: userByLink });
    }

    const userByEmail = await this.usersRepository.findByEmail(
      email.toString(),
    );

    if (userByEmail) {
      userByEmail.linkSocialAccount(provider, subjectId);
      await this.usersRepository.save(userByEmail);
      return right({ user: userByEmail });
    }

    const displayName =
      name?.trim() || email.toString().split("@")[0] || "User";

    const role = roleForNewUser ?? "CUSTOMER";

    let user: User;

    if (role === "ESTABLISHMENT") {
      await this.unitOfWork.execute(async () => {
        user = User.register({
          name: displayName,
          email,
          hashedPassword: null,
          role,
          profileImageUrl: null,
          phone: null,
          address: null,
          socialAccounts: [{ provider, subjectId }],
        });

        const establishment = Establishment.createOAuthDraft({
          ownerId: user.id,
        });

        await this.usersRepository.create(user);
        await this.establishmentsRepository.create(establishment);
      });
    } else {
      await this.unitOfWork.execute(async () => {
        user = User.register({
          name: displayName,
          email,
          hashedPassword: null,
          role,
          profileImageUrl: null,
          phone: null,
          address: null,
          socialAccounts: [{ provider, subjectId }],
        });

        await this.usersRepository.create(user);
      });
    }

    return right({ user: user! });
  }
}
