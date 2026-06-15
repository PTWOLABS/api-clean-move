import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
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
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { UploadDomainImageUseCase } from "../../../../modules/application/use-cases/media/upload-domain-image";
import { AuthenticatedUser } from "../../../auth/authenticated-user";
import { CurrentUser } from "../../../auth/current-user";
import { Roles } from "../../../auth/roles";
import {
  UploadImageFileBodyDto,
  UploadImageResponseDto,
} from "../../docs/upload-swagger.dto";
import {
  ensureUploadedFile,
  throwUploadError,
  UploadedImageHttpFile,
} from "./media-upload-http";

const establishmentIdParamSchema = z.uuid();

@ApiTags("establishment")
@ApiBearerAuth("access-token")
@Controller("/establishments/:establishmentId/banner-image")
@Roles(["ESTABLISHMENT"])
export class UploadEstablishmentBannerImageController {
  constructor(private readonly uploadDomainImage: UploadDomainImageUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UploadImageFileBodyDto })
  @ApiOperation({ summary: "Upload banner image for an establishment." })
  @ApiParam({ name: "establishmentId", format: "uuid" })
  @ApiCreatedResponse({
    description: "Image uploaded successfully.",
    type: UploadImageResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid establishment id or image file.",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({ description: "Operation not allowed." })
  @ApiNotFoundResponse({
    description: "Establishment not found for authenticated owner.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected storage failure.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("establishmentId") establishmentId: string,
    @UploadedFile() file: UploadedImageHttpFile | undefined,
  ) {
    const parsedEstablishmentId =
      establishmentIdParamSchema.safeParse(establishmentId);
    if (!parsedEstablishmentId.success) {
      throw new BadRequestException(parsedEstablishmentId.error.message);
    }

    const uploadFile = ensureUploadedFile(file);
    const result = await this.uploadDomainImage.execute({
      establishmentOwnerId: user.userId,
      kind: "ESTABLISHMENT_BANNER",
      entityId: parsedEstablishmentId.data,
      file: uploadFile,
    });

    if (result.isLeft()) {
      throwUploadError(result.value);
    }

    return result.value;
  }
}
