import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { UploadUserProfileImageUseCase } from "../../../modules/application/use-cases/user/upload-user-profile-image";
import { InvalidUploadedImageError } from "../../../shared/errors/invalid-uploaded-image-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import {
  ensureUploadedFile,
  UploadedImageHttpFile,
} from "./media/media-upload-http";
import {
  UploadImageFileBodyDto,
  UploadImageResponseDto,
} from "../docs/upload-swagger.dto";
import { MAX_UPLOADED_IMAGE_BYTES } from "../../../shared/utils/validate-uploaded-image-file";

@ApiTags("user")
@ApiBearerAuth("access-token")
@Controller("user")
export class UploadUserProfileImageController {
  constructor(
    private readonly uploadUserProfileImage: UploadUserProfileImageUseCase,
  ) {}

  @Post("profile-image")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_UPLOADED_IMAGE_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UploadImageFileBodyDto })
  @ApiOperation({
    summary: "Upload or replace the authenticated user profile image.",
  })
  @ApiCreatedResponse({
    description: "Profile image uploaded successfully.",
    type: UploadImageResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid image file." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiNotFoundResponse({ description: "User not found." })
  @ApiInternalServerErrorResponse({
    description: "Unexpected storage failure.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedImageHttpFile | undefined,
  ) {
    const uploadFile = ensureUploadedFile(file);
    const result = await this.uploadUserProfileImage.execute({
      userId: user.userId,
      file: uploadFile,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case InvalidUploadedImageError:
          throw new BadRequestException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new InternalServerErrorException((error as Error).message);
      }
    }

    return result.value;
  }
}
