import { InvalidUploadedImageError } from "../errors/invalid-uploaded-image-error";

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_UPLOADED_IMAGE_BYTES = 5 * 1024 * 1024;

export type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

export function validateUploadedImageFile(
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

  if (file.buffer.length > MAX_UPLOADED_IMAGE_BYTES) {
    return new InvalidUploadedImageError(
      `Image exceeds maximum size of ${MAX_UPLOADED_IMAGE_BYTES} bytes.`,
    );
  }

  return null;
}
