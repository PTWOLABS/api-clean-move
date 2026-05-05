import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { InvalidUploadedImageError } from "../../../../shared/errors/invalid-uploaded-image-error";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { buildPublicObjectUrl } from "../../../../shared/utils/build-public-object-url";
import { sanitizeUploadedFileName } from "../../../../shared/utils/sanitize-uploaded-file-name";
import { EnvService } from "../../../../infra/env/env.service";
import {
  ObjectStorage,
  ObjectStoragePutInput,
} from "../../repositories/object-storage";
import { CustomersRepository } from "../../repositories/customers-repository";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

export const DOMAIN_IMAGE_KIND = [
  "EMPLOYEE_PROFILE",
  "CUSTOMER_PROFILE",
  "VEHICLE",
  "ESTABLISHMENT_BANNER",
] as const;

export type DomainImageKind = (typeof DOMAIN_IMAGE_KIND)[number];

const KIND_TO_PREFIX: Record<DomainImageKind, string> = {
  EMPLOYEE_PROFILE: "employee-profile",
  CUSTOMER_PROFILE: "customer-profile",
  VEHICLE: "vehicle",
  ESTABLISHMENT_BANNER: "establishment-banner",
};

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

type UploadDomainImageUseCaseRequest = {
  establishmentOwnerId: string;
  kind: DomainImageKind;
  entityId: string;
  file: UploadedImageFile;
};

type UploadDomainImageUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InvalidUploadedImageError
  | UnexpectedDomainError,
  { url: string; objectKey: string }
>;

@Injectable()
export class UploadDomainImageUseCase {
  constructor(
    private readonly envService: EnvService,
    private readonly objectStorage: ObjectStorage,
    private readonly establishmentsRepository: EstablishmentsRepository,
    private readonly employeesRepository: EmployeesRepository,
    private readonly customersRepository: CustomersRepository,
    private readonly customerVehiclesRepository: CustomerVehiclesRepository,
  ) {}

  async execute(
    request: UploadDomainImageUseCaseRequest,
  ): Promise<UploadDomainImageUseCaseResponse> {
    const validation = this.validateFile(request.file);
    if (validation !== null) {
      return left(validation);
    }

    const establishment = await this.establishmentsRepository.findByOwnerId(
      request.establishmentOwnerId,
    );

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "Establishment" }));
    }

    const fileUuid = randomUUID();
    const safeName = sanitizeUploadedFileName(request.file.originalname);
    const prefix = KIND_TO_PREFIX[request.kind];
    const objectKey = `${prefix}/${fileUuid}/${safeName}`;

    const putInput: ObjectStoragePutInput = {
      key: objectKey,
      buffer: request.file.buffer,
      contentType: request.file.mimetype,
    };

    try {
      await this.objectStorage.putObject(putInput);
    } catch {
      return left(new UnexpectedDomainError());
    }

    const publicBaseUrl = this.envService.get("AWS_S3_PUBLIC_BASE_URL");
    const url = buildPublicObjectUrl(publicBaseUrl, objectKey);

    try {
      if (request.kind === "EMPLOYEE_PROFILE") {
        const employee =
          await this.employeesRepository.findByIdAndEstablishmentId(
            request.entityId,
            establishment.id.toString(),
          );

        if (!employee) {
          return left(new ResourceNotFoundError({ resource: "Employee" }));
        }

        employee.setProfileImageUrl(url);
        await this.employeesRepository.save(employee);
      } else if (request.kind === "CUSTOMER_PROFILE") {
        const customer =
          await this.customersRepository.findByIdAndEstablishmentId(
            request.entityId,
            establishment.id.toString(),
          );

        if (!customer) {
          return left(new ResourceNotFoundError({ resource: "Customer" }));
        }

        customer.update({ profileImageUrl: url });
        await this.customersRepository.save(customer);
      } else if (request.kind === "VEHICLE") {
        const vehicle =
          await this.customerVehiclesRepository.findByIdAndEstablishmentId(
            request.entityId,
            establishment.id.toString(),
          );

        if (!vehicle) {
          return left(
            new ResourceNotFoundError({ resource: "CustomerVehicle" }),
          );
        }

        vehicle.update({ imageUrl: url });
        await this.customerVehiclesRepository.save(vehicle);
      } else {
        if (request.entityId !== establishment.id.toString()) {
          return left(new NotAllowedError());
        }

        establishment.setBannerImageUrl(url);
        await this.establishmentsRepository.save(establishment);
      }
    } catch {
      return left(new UnexpectedDomainError());
    }

    return right({ url, objectKey });
  }

  private validateFile(
    file: UploadedImageFile,
  ): InvalidUploadedImageError | null {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return new InvalidUploadedImageError(
        "Unsupported image type. Allowed: JPEG, PNG, WebP.",
      );
    }

    if (file.buffer.length === 0) {
      return new InvalidUploadedImageError("Empty file.");
    }

    if (file.buffer.length > MAX_IMAGE_BYTES) {
      return new InvalidUploadedImageError(
        `Image exceeds maximum size of ${MAX_IMAGE_BYTES} bytes.`,
      );
    }

    return null;
  }
}
