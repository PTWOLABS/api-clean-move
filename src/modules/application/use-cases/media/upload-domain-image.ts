import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { InvalidUploadedImageError } from "../../../../shared/errors/invalid-uploaded-image-error";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { buildPublicObjectUrl } from "../../../../shared/utils/build-public-object-url";
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
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

export const DOMAIN_IMAGE_KIND = ["VEHICLE", "ESTABLISHMENT_BANNER"] as const;

export type DomainImageKind = (typeof DOMAIN_IMAGE_KIND)[number];

const KIND_TO_PREFIX: Record<DomainImageKind, string> = {
  VEHICLE: "vehicle",
  ESTABLISHMENT_BANNER: "establishment-banner",
};

export type { UploadedImageFile };

type UploadDomainImageUseCaseRequest = {
  establishmentOwnerId: string;
  kind: DomainImageKind;
  entityId: string;
  customerId?: string;
  file: UploadedImageFile;
};

type UploadDomainImageUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InvalidUploadedImageError
  | UnexpectedDomainError,
  { url: string }
>;

@Injectable()
export class UploadDomainImageUseCase {
  constructor(
    private readonly envService: EnvService,
    private readonly objectStorage: ObjectStorage,
    private readonly establishmentsRepository: EstablishmentsRepository,
    private readonly customerVehiclesRepository: CustomerVehiclesRepository,
  ) {}

  async execute(
    request: UploadDomainImageUseCaseRequest,
  ): Promise<UploadDomainImageUseCaseResponse> {
    const validation = validateUploadedImageFile(request.file);
    if (validation !== null) {
      return left(validation);
    }

    const establishment = await this.establishmentsRepository.findByOwnerId(
      request.establishmentOwnerId,
    );

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "Establishment" }));
    }

    let persistImageUrl: ((url: string) => Promise<void>) | null = null;
    try {
      if (request.kind === "VEHICLE") {
        const vehicle = request.customerId
          ? await this.customerVehiclesRepository.findByIdAndCustomerIdAndEstablishmentId(
              request.entityId,
              request.customerId,
              establishment.id.toString(),
            )
          : await this.customerVehiclesRepository.findByIdAndEstablishmentId(
              request.entityId,
              establishment.id.toString(),
            );

        if (!vehicle) {
          return left(
            new ResourceNotFoundError({ resource: "CustomerVehicle" }),
          );
        }

        persistImageUrl = async (url) => {
          vehicle.update({ imageUrl: url });
          await this.customerVehiclesRepository.save(vehicle);
        };
      } else {
        if (request.entityId !== establishment.id.toString()) {
          return left(new NotAllowedError());
        }

        persistImageUrl = async (url) => {
          establishment.setBannerImageUrl(url);
          await this.establishmentsRepository.save(establishment);
        };
      }
    } catch {
      return left(new UnexpectedDomainError());
    }

    if (!persistImageUrl) {
      return left(new UnexpectedDomainError());
    }

    const fileUuid = randomUUID();
    const safeName = sanitizeUploadedFileName(request.file.originalname);
    const prefix = KIND_TO_PREFIX[request.kind];
    const objectKey = `${prefix}/${fileUuid}/${safeName}`;
    const publicBaseUrl = this.envService.get("AWS_S3_PUBLIC_BASE_URL");
    const url = buildPublicObjectUrl(publicBaseUrl, objectKey);

    const putInput: ObjectStoragePutInput = {
      key: objectKey,
      buffer: request.file.buffer,
      contentType: request.file.mimetype,
    };

    try {
      await this.objectStorage.putObject(putInput);
      await persistImageUrl(url);
    } catch {
      return left(new UnexpectedDomainError());
    }

    return right({ url });
  }
}
