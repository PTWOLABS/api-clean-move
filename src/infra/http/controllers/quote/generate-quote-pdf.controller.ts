import { Controller, Get, Param, Res } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import z from "zod";
import { EmployeeFeatures } from "../../../auth/employee-features";
import { Roles } from "../../../auth/roles";
import { GenerateQuotePdfUseCase } from "../../../../modules/application/use-cases/quote/generate-quote-pdf";
import { AuthenticatedUser } from "../../../auth/authenticated-user";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe";
import { CurrentUser } from "../../../auth/current-user";
import { throwQuoteHttpError } from "./quote-http-errors";

const quoteIdParamSchema = z.uuid();

@ApiTags("quotes")
@ApiBearerAuth("access-token")
@Controller("/quotes/:quoteId/pdf")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["read:quotes"])
export class GenerateQuotePdfController {
  constructor(private readonly generateQuotePdf: GenerateQuotePdfUseCase) {}

  @Get()
  @ApiOperation({
    summary: "Generate a PDF for a commercial quote.",
  })
  @ApiParam({ name: "quoteId", format: "uuid" })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "Quote PDF generated successfully.",
    content: {
      "application/pdf": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
    },
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
    @Res() response: Response,
  ) {
    const result = await this.generateQuotePdf.execute({
      actor: { userId: user.userId, role: user.role },
      quoteId,
    });

    if (result.isLeft()) {
      throwQuoteHttpError(result.value);
    }

    response.setHeader("Content-Type", result.value.contentType);
    response.setHeader(
      "Content-Disposition",
      `inline; filename="${result.value.fileName}"`,
    );
    response.send(result.value.pdf);
  }
}
