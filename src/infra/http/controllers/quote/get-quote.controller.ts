import {
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { GetQuoteUseCase } from "../../../../modules/application/use-cases/quote/get-quote";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { AuthenticatedUser } from "../../../auth/authenticated-user";
import { CurrentUser } from "../../../auth/current-user";
import { EmployeeFeatures } from "../../../auth/employee-features";
import { Roles } from "../../../auth/roles";
import { QuoteResponseDto } from "../../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe";
import { QuotePresenter } from "../../presenters/quote-presenter";

const quoteIdParamSchema = z.uuid();

@ApiTags("quotes")
@ApiBearerAuth("access-token")
@Controller("/quotes/:quoteId")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["read:quotes"])
export class GetQuoteController {
  constructor(private readonly getQuote: GetQuoteUseCase) {}

  @Get()
  @ApiOperation({
    summary:
      "Get a commercial quote by id for the authenticated establishment.",
  })
  @ApiParam({ name: "quoteId", format: "uuid" })
  @ApiOkResponse({
    description: "Quote found successfully.",
    type: QuoteResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid quote id." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({
    description:
      "Authenticated user does not have the required role or employee feature.",
  })
  @ApiNotFoundResponse({ description: "Quote or establishment not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("quoteId", new ZodValidationPipe(quoteIdParamSchema))
    quoteId: string,
  ) {
    const result = await this.getQuote.execute({
      actor: { userId: user.userId, role: user.role },
      quoteId,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case NotAllowedError:
          throw new ForbiddenException(error.message);
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        default:
          throw new InternalServerErrorException(error.message);
      }
    }

    return {
      quote: QuotePresenter.toHTTP(result.value.quote),
    };
  }
}
