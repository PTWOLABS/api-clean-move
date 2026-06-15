import { Injectable } from "@nestjs/common";
import { User } from "../../../accounts/domain/entities/user";
import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UsersRepository } from "../../repositories/users-repository";
import { UserEstablishmentResolver } from "../../services/user-establishment-resolver";

type GetMeUseCaseRequest = {
  userId: string;
};

type GetMeUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    user: User;
    establishmentId: string | null;
    onboardingCompletedAt: Date | null;
  }
>;

@Injectable()
export class GetMeUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private userEstablishmentResolver: UserEstablishmentResolver,
  ) {}

  async execute({
    userId,
  }: GetMeUseCaseRequest): Promise<GetMeUseCaseResponse> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return left(new ResourceNotFoundError({ resource: "user" }));
    }

    const establishmentContext =
      await this.userEstablishmentResolver.resolveEstablishmentContext(user);

    return right({
      user,
      establishmentId: establishmentContext.establishmentId,
      onboardingCompletedAt: establishmentContext.onboardingCompletedAt,
    });
  }
}
