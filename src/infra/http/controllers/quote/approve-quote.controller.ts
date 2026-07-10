import { Body, Controller, Param, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
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

import { ApproveQuoteUseCase } from "../../../../modules/application/use-cases/quote/approve-quote";
import { AuthenticatedUser } from "../../../auth/authenticated-user";
import { CurrentUser } from "../../../auth/current-user";
import { EmployeeFeatures } from "../../../auth/employee-features";
import { Roles } from "../../../auth/roles";
import {
  ApproveQuoteBodyDto,
  ApproveQuoteResponseDto,
  QuoteErrorResponseDto,
  QuoteValidationErrorResponseDto,
} from "../../docs/domain-swagger.dto";
import { AppointmentPresenter } from "../../presenters/appointment-presenter";
import { QuotePresenter } from "../../presenters/quote-presenter";
import { throwQuoteHttpError } from "./quote-http-errors";
import { QuoteZodValidationPipe } from "./quote-zod-validation.pipe";

const quoteIdParamSchema = z.uuid();

const approveQuoteBodySchema = z.object({
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
});

type ApproveQuoteBodySchema = z.infer<typeof approveQuoteBodySchema>;

@ApiTags("quotes")
@ApiBearerAuth("access-token")
@Controller("/quotes/:quoteId/approve")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["approve:quotes"])
export class ApproveQuoteController {
  constructor(private readonly approveQuote: ApproveQuoteUseCase) {}

  @Post()
  @ApiOperation({
    summary: "Approve a customer quote and create an appointment.",
  })
  @ApiParam({ name: "quoteId", format: "uuid" })
  @ApiBody({ type: ApproveQuoteBodyDto })
  @ApiCreatedResponse({
    description: "Quote approved successfully.",
    type: ApproveQuoteResponseDto,
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
    description: "Quote, appointment dependency, or establishment not found.",
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
    @Body(new QuoteZodValidationPipe(approveQuoteBodySchema))
    body: ApproveQuoteBodySchema,
  ) {
    const result = await this.approveQuote.execute({
      actor: { userId: user.userId, role: user.role },
      quoteId,
      startsAt: body.startsAt,
      endsAt: body.endsAt ?? null,
    });

    if (result.isLeft()) {
      throwQuoteHttpError(result.value);
    }

    return {
      appointment: AppointmentPresenter.toHTTP(result.value.appointment),
      quote: QuotePresenter.toHTTP(result.value.quote),
    };
  }
}
