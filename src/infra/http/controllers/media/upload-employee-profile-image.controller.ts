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

const employeeIdParamSchema = z.uuid();

@ApiTags("media")
@ApiBearerAuth("access-token")
@Controller("/employees/:employeeId/profile-image")
@Roles(["ESTABLISHMENT"])
export class UploadEmployeeProfileImageController {
  constructor(private readonly uploadDomainImage: UploadDomainImageUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload profile image for an employee." })
  @ApiParam({ name: "employeeId", format: "uuid" })
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
  @ApiBadRequestResponse({ description: "Invalid employee id or image file." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({ description: "Operation not allowed." })
  @ApiNotFoundResponse({ description: "Establishment or employee not found." })
  @ApiInternalServerErrorResponse({
    description: "Unexpected storage failure.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("employeeId") employeeId: string,
    @UploadedFile() file: UploadedImageHttpFile | undefined,
  ) {
    const parsedEmployeeId = employeeIdParamSchema.safeParse(employeeId);
    if (!parsedEmployeeId.success) {
      throw new BadRequestException(parsedEmployeeId.error.message);
    }

    const uploadFile = ensureUploadedFile(file);
    const result = await this.uploadDomainImage.execute({
      establishmentOwnerId: user.userId,
      kind: "EMPLOYEE_PROFILE",
      entityId: parsedEmployeeId.data,
      file: uploadFile,
    });

    if (result.isLeft()) {
      throwUploadError(result.value);
    }

    return result.value;
  }
}
