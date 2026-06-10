import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { extractObjectKeyFromPublicUrl } from "../../../../shared/utils/extract-object-key-from-public-url";
import { EnvService } from "../../../../infra/env/env.service";
import { ObjectStorage } from "../../repositories/object-storage";
import { UsersRepository } from "../../repositories/users-repository";

type DeleteUserProfileImageUseCaseRequest = {
  userId: string;
};

type DeleteUserProfileImageUseCaseResponse = Either<
  ResourceNotFoundError | UnexpectedDomainError,
  void
>;

@Injectable()
export class DeleteUserProfileImageUseCase {
  constructor(
    private readonly envService: EnvService,
    private readonly objectStorage: ObjectStorage,
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(
    request: DeleteUserProfileImageUseCaseRequest,
  ): Promise<DeleteUserProfileImageUseCaseResponse> {
    const user = await this.usersRepository.findById(request.userId);
    if (!user) {
      return left(new ResourceNotFoundError({ resource: "user" }));
    }

    const currentUrl = user.profileImageUrl;
    if (currentUrl === null) {
      return left(
        new ResourceNotFoundError({ message: "Profile image not found." }),
      );
    }

    const publicBaseUrl = this.envService.get("AWS_S3_PUBLIC_BASE_URL");
    const objectKey = extractObjectKeyFromPublicUrl(publicBaseUrl, currentUrl);

    if (objectKey !== null) {
      try {
        await this.objectStorage.deleteObject(objectKey);
      } catch {
        return left(new UnexpectedDomainError());
      }
    }

    try {
      user.update({ profileImageUrl: null });
      await this.usersRepository.save(user);
    } catch {
      return left(new UnexpectedDomainError());
    }

    return right(undefined);
  }
}
