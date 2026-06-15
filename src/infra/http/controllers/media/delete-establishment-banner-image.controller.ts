import {
  BadRequestException,
  Controller,
  Delete,
  HttpCode,
  Param,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { DeleteEstablishmentBannerImageUseCase } from "../../../../modules/application/use-cases/media/delete-establishment-banner-image";
import { AuthenticatedUser } from "../../../auth/authenticated-user";
import { CurrentUser } from "../../../auth/current-user";
import { Roles } from "../../../auth/roles";
import { throwUploadError } from "./media-upload-http";

const establishmentIdParamSchema = z.uuid();

@ApiTags("establishment")
@ApiBearerAuth("access-token")
@Controller("/establishments/:establishmentId/banner-image")
@Roles(["ESTABLISHMENT"])
export class DeleteEstablishmentBannerImageController {
  constructor(
    private readonly deleteEstablishmentBannerImage: DeleteEstablishmentBannerImageUseCase,
  ) {}

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: "Remove banner image for an establishment." })
  @ApiParam({ name: "establishmentId", format: "uuid" })
  @ApiNoContentResponse({ description: "Banner image removed successfully." })
  @ApiBadRequestResponse({ description: "Invalid establishment id." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({ description: "Operation not allowed." })
  @ApiNotFoundResponse({
    description: "Establishment or banner image not found.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected storage failure.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("establishmentId") establishmentId: string,
  ) {
    const parsedEstablishmentId =
      establishmentIdParamSchema.safeParse(establishmentId);
    if (!parsedEstablishmentId.success) {
      throw new BadRequestException(parsedEstablishmentId.error.message);
    }

    const result = await this.deleteEstablishmentBannerImage.execute({
      establishmentOwnerId: user.userId,
      establishmentId: parsedEstablishmentId.data,
    });

    if (result.isLeft()) {
      throwUploadError(result.value);
    }
  }
}
