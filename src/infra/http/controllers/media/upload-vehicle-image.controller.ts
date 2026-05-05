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
  ensureUploadedFile,
  throwUploadError,
  UploadedImageHttpFile,
} from "./media-upload-http";

const customerIdParamSchema = z.uuid();
const vehicleIdParamSchema = z.uuid();

@ApiTags("media")
@ApiBearerAuth("access-token")
@Controller("/customers/:customerId/vehicles/:vehicleId/image")
@Roles(["ESTABLISHMENT"])
export class UploadVehicleImageController {
  constructor(private readonly uploadDomainImage: UploadDomainImageUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload image for a customer vehicle." })
  @ApiParam({ name: "customerId", format: "uuid" })
  @ApiParam({ name: "vehicleId", format: "uuid" })
  @ApiCreatedResponse({
    description: "Image uploaded successfully.",
    schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        objectKey: { type: "string" },
      },
    },
  })
  @ApiBadRequestResponse({ description: "Invalid ids or image file." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({ description: "Operation not allowed." })
  @ApiNotFoundResponse({ description: "Establishment or vehicle not found." })
  @ApiInternalServerErrorResponse({
    description: "Unexpected storage failure.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("customerId") customerId: string,
    @Param("vehicleId") vehicleId: string,
    @UploadedFile() file: UploadedImageHttpFile | undefined,
  ) {
    const parsedCustomerId = customerIdParamSchema.safeParse(customerId);
    if (!parsedCustomerId.success) {
      throw new BadRequestException(parsedCustomerId.error.message);
    }

    const parsedVehicleId = vehicleIdParamSchema.safeParse(vehicleId);
    if (!parsedVehicleId.success) {
      throw new BadRequestException(parsedVehicleId.error.message);
    }

    const uploadFile = ensureUploadedFile(file);
    const result = await this.uploadDomainImage.execute({
      establishmentOwnerId: user.userId,
      kind: "VEHICLE",
      entityId: parsedVehicleId.data,
      file: uploadFile,
    });

    if (result.isLeft()) {
      throwUploadError(result.value);
    }

    return result.value;
  }
}
