import { randomUUID } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { InvalidUploadedImageError } from "../../../../shared/errors/invalid-uploaded-image-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { buildPublicObjectUrl } from "../../../../shared/utils/build-public-object-url";
import { extractObjectKeyFromPublicUrl } from "../../../../shared/utils/extract-object-key-from-public-url";
import { sanitizeUploadedFileName } from "../../../../shared/utils/sanitize-uploaded-file-name";
import {
  UploadedImageFile,
  validateUploadedImageFile,
} from "../../../../shared/utils/validate-uploaded-image-file";
import { EnvService } from "../../../../infra/env/env.service";
import {
  ObjectStorage,
  ObjectStoragePutInput,
} from "../../repositories/object-storage";
import { UsersRepository } from "../../repositories/users-repository";

export type { UploadedImageFile };

type UploadUserProfileImageUseCaseRequest = {
  userId: string;
  file: UploadedImageFile;
};

type UploadUserProfileImageUseCaseResponse = Either<
  ResourceNotFoundError | InvalidUploadedImageError | UnexpectedDomainError,
  { url: string }
>;

@Injectable()
export class UploadUserProfileImageUseCase {
  private readonly logger = new Logger(UploadUserProfileImageUseCase.name);

  constructor(
    private readonly envService: EnvService,
    private readonly objectStorage: ObjectStorage,
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(
    request: UploadUserProfileImageUseCaseRequest,
  ): Promise<UploadUserProfileImageUseCaseResponse> {
    const validation = validateUploadedImageFile(request.file);
    if (validation !== null) {
      return left(validation);
    }

    const user = await this.usersRepository.findById(request.userId);
    if (!user) {
      return left(new ResourceNotFoundError({ resource: "user" }));
    }

    const previousUrl = user.profileImageUrl;
    const fileUuid = randomUUID();
    const safeName = sanitizeUploadedFileName(request.file.originalname);
    const objectKey = `user-profile/${fileUuid}/${safeName}`;
    const publicBaseUrl = this.envService.get("AWS_S3_PUBLIC_BASE_URL");
    const url = buildPublicObjectUrl(publicBaseUrl, objectKey);

    const putInput: ObjectStoragePutInput = {
      key: objectKey,
      buffer: request.file.buffer,
      contentType: request.file.mimetype,
    };

    try {
      await this.objectStorage.putObject(putInput);
      user.update({ profileImageUrl: url });
      await this.usersRepository.save(user);
    } catch {
      return left(new UnexpectedDomainError());
    }

    await this.deletePreviousObjectBestEffort(publicBaseUrl, previousUrl);

    return right({ url });
  }

  private async deletePreviousObjectBestEffort(
    publicBaseUrl: string,
    previousUrl: string | null,
  ): Promise<void> {
    if (previousUrl === null) {
      return;
    }

    const previousKey = extractObjectKeyFromPublicUrl(
      publicBaseUrl,
      previousUrl,
    );
    if (previousKey === null) {
      return;
    }

    try {
      await this.objectStorage.deleteObject(previousKey);
    } catch (error) {
      this.logger.warn(
        `Failed to delete previous profile image object "${previousKey}".`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
