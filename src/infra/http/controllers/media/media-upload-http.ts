import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InvalidUploadedImageError } from "../../../../shared/errors/invalid-uploaded-image-error";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";

export type UploadedImageHttpFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

export function ensureUploadedFile(
  file: UploadedImageHttpFile | undefined,
): UploadedImageHttpFile {
  if (!file) {
    throw new BadRequestException("file is required.");
  }

  return file;
}

export function throwUploadError(error: unknown): never {
  switch ((error as { constructor?: unknown })?.constructor) {
    case ResourceNotFoundError:
      throw new NotFoundException((error as Error).message);
    case NotAllowedError:
      throw new ForbiddenException((error as Error).message);
    case InvalidUploadedImageError:
      throw new BadRequestException((error as Error).message);
    case UnexpectedDomainError:
      throw new InternalServerErrorException((error as Error).message);
    default:
      throw new BadRequestException((error as Error).message);
  }
}
