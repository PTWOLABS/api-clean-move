import { Body, Controller, Param, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AnalyzeQuoteApprovalUseCase } from "../../../../modules/application/use-cases/quote/analyze-quote-approval";
import { AuthenticatedUser } from "../../../auth/authenticated-user";
import { CurrentUser } from "../../../auth/current-user";
import { EmployeeFeatures } from "../../../auth/employee-features";
import { Roles } from "../../../auth/roles";
import {
  AnalyzeQuoteApprovalBodyDto,
  AnalyzeQuoteApprovalResponseDto,
  QuoteErrorResponseDto,
  QuoteValidationErrorResponseDto,
} from "../../docs/domain-swagger.dto";
import { throwQuoteHttpError } from "./quote-http-errors";
import {
  quoteApprovalScheduleSchema,
  quoteIdParamSchema,
} from "./quote-approval-resolution.schemas";
import { QuoteZodValidationPipe } from "./quote-zod-validation.pipe";

type AnalyzeQuoteApprovalBodySchema = typeof quoteApprovalScheduleSchema._output;

@ApiTags("quotes")
@ApiBearerAuth("access-token")
@Controller("/quotes/:quoteId/approval-analysis")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["approve:quotes"])
export class AnalyzeQuoteApprovalController {
  constructor(private readonly analyzeQuoteApproval: AnalyzeQuoteApprovalUseCase) {}

  @Post()
  @ApiOperation({
    summary: "Analyze quote approval resource conflicts without writing data.",
  })
  @ApiParam({ name: "quoteId", format: "uuid" })
  @ApiBody({ type: AnalyzeQuoteApprovalBodyDto })
  @ApiOkResponse({
    description: "Quote approval analysis generated successfully.",
    type: AnalyzeQuoteApprovalResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid payload or quote approval rule.",
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
    @Body(new QuoteZodValidationPipe(quoteApprovalScheduleSchema))
    body: AnalyzeQuoteApprovalBodySchema,
  ) {
    const result = await this.analyzeQuoteApproval.execute({
      actor: { userId: user.userId, role: user.role },
      quoteId,
      startsAt: body.startsAt,
      endsAt: body.endsAt ?? null,
    });

    if (result.isLeft()) {
      throwQuoteHttpError(result.value);
    }

    return { analysis: result.value.analysis };
  }
}
