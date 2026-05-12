import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { GetMeUseCase } from "../../../modules/application/use-cases/user/get-me";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { GetMeResponseDto } from "../docs/user-swagger.dto";
import { UserPresenter } from "../presenters/user-presenter";

@ApiTags("user")
@ApiBearerAuth("access-token")
@Controller("user")
export class GetMeController {
  constructor(private readonly getMe: GetMeUseCase) {}

  @Get("me")
  @ApiOperation({ summary: "Get the authenticated user profile." })
  @ApiOkResponse({
    description: "Current user serialized for the client (no password hash).",
    type: GetMeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiNotFoundResponse({
    description: "User no longer exists for the authenticated session.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while loading the user.",
  })
  async handle(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.getMe.execute({ userId: user.userId });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        default:
          throw new InternalServerErrorException(error.message);
      }
    }

    return {
      user: UserPresenter.toHTTP(result.value.user),
    };
  }
}
