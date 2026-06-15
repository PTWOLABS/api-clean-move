import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { extractObjectKeyFromPublicUrl } from "../../../../shared/utils/extract-object-key-from-public-url";
import { EnvService } from "../../../../infra/env/env.service";
import { ObjectStorage } from "../../repositories/object-storage";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type DeleteEstablishmentBannerImageUseCaseRequest = {
  establishmentOwnerId: string;
  establishmentId: string;
};

type DeleteEstablishmentBannerImageUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError | UnexpectedDomainError,
  void
>;

@Injectable()
export class DeleteEstablishmentBannerImageUseCase {
  constructor(
    private readonly envService: EnvService,
    private readonly objectStorage: ObjectStorage,
    private readonly establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute(
    request: DeleteEstablishmentBannerImageUseCaseRequest,
  ): Promise<DeleteEstablishmentBannerImageUseCaseResponse> {
    const establishment = await this.establishmentsRepository.findByOwnerId(
      request.establishmentOwnerId,
    );

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "Establishment" }));
    }

    if (request.establishmentId !== establishment.id.toString()) {
      return left(new NotAllowedError());
    }

    const currentUrl = establishment.bannerImageUrl;
    if (currentUrl === null) {
      return left(
        new ResourceNotFoundError({ message: "Banner image not found." }),
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
      establishment.clearBannerImageUrl();
      await this.establishmentsRepository.save(establishment);
    } catch {
      return left(new UnexpectedDomainError());
    }

    return right(undefined);
  }
}
