import { Controller, Get, Param } from "@nestjs/common";
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
import { AuthenticatedUser } from "../../../auth/authenticated-user";
import { CurrentUser } from "../../../auth/current-user";
import { EmployeeFeatures } from "../../../auth/employee-features";
import { Roles } from "../../../auth/roles";
import {
  QuoteErrorResponseDto,
  QuoteResponseDto,
  QuoteValidationErrorResponseDto,
} from "../../docs/domain-swagger.dto";
import { QuotePresenter } from "../../presenters/quote-presenter";
import { throwQuoteHttpError } from "./quote-http-errors";
import { QuoteZodValidationPipe } from "./quote-zod-validation.pipe";

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
  @ApiBadRequestResponse({
    description: "Invalid quote id.",
    type: QuoteValidationErrorResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({
    description:
      "Authenticated user does not have the required role or employee feature.",
    type: QuoteErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Quote or establishment not found.",
    type: QuoteErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure.",
    type: QuoteErrorResponseDto,
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("quoteId", new QuoteZodValidationPipe(quoteIdParamSchema))
    quoteId: string,
  ) {
    const result = await this.getQuote.execute({
      actor: { userId: user.userId, role: user.role },
      quoteId,
    });

    if (result.isLeft()) {
      throwQuoteHttpError(result.value);
    }

    return {
      quote: QuotePresenter.toHTTP(result.value.quote),
    };
  }
}
