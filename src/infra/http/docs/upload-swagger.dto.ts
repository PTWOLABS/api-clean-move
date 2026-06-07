import { ApiProperty } from "@nestjs/swagger";

export class UploadImageFileBodyDto {
  @ApiProperty({
    type: "string",
    format: "binary",
    description: "Image file (JPEG, PNG, or WebP).",
  })
  file!: unknown;
}

export class UploadImageResponseDto {
  @ApiProperty({
    example: "https://cdn.example.com/user-profile/uuid/photo.png",
    description: "Public URL of the uploaded image.",
  })
  url!: string;
}
