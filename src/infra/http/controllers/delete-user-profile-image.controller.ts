import {
  Controller,
  Delete,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { DeleteUserProfileImageUseCase } from "../../../modules/application/use-cases/user/delete-user-profile-image";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";

@ApiTags("user")
@ApiBearerAuth("access-token")
@Controller("user")
export class DeleteUserProfileImageController {
  constructor(
    private readonly deleteUserProfileImage: DeleteUserProfileImageUseCase,
  ) {}

  @Delete("profile-image")
  @HttpCode(204)
  @ApiOperation({
    summary: "Remove the authenticated user profile image.",
  })
  @ApiNoContentResponse({ description: "Profile image removed successfully." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiNotFoundResponse({ description: "User or profile image not found." })
  @ApiInternalServerErrorResponse({
    description: "Unexpected storage failure.",
  })
  async handle(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.deleteUserProfileImage.execute({
      userId: user.userId,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new InternalServerErrorException((error as Error).message);
      }
    }
  }
}
