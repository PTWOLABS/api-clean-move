import { Body, Controller, Param, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
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
import { Roles } from "../../../auth/roles";
import { EmployeeFeatures } from "../../../auth/employee-features";
import { RegisterQuoteProspectAsCustomerUseCase } from "../../../../modules/application/use-cases/quote/register-quote-prospect-as-customer";
import {
  RegisterQuoteProspectBodyDto,
  RegisterQuoteProspectResponseDto,
} from "../../docs/domain-swagger.dto";
import { AuthenticatedUser } from "../../../auth/authenticated-user";
import { CurrentUser } from "../../../auth/current-user";
import { throwQuoteHttpError } from "./quote-http-errors";
import { CustomerPresenter } from "../../presenters/customer-presenter";
import { CustomerVehiclePresenter } from "../../presenters/customer-vehicle-presenter";
import { QuotePresenter } from "../../presenters/quote-presenter";
import { QuoteZodValidationPipe } from "./quote-zod-validation.pipe";

const quoteIdParamSchema = z.uuid();

const registerQuoteProspectBodySchema = z.object({
  email: z.email().trim(),
  phone: z.string().trim().min(1).optional(),
  birthDate: z.coerce.date().optional().nullable(),
  nickname: z.string().trim().optional().nullable(),
  createVehicleFromQuote: z.boolean().optional(),
});

type RegisterQuoteProspectBodySchema = z.infer<
  typeof registerQuoteProspectBodySchema
>;

@ApiTags("quotes")
@ApiBearerAuth("access-token")
@Controller("/quotes/:quoteId/register-customer")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["create:customers"])
export class RegisterQuoteProspectAsCustomerController {
  constructor(
    private readonly registerQuoteProspectAsCustomer: RegisterQuoteProspectAsCustomerUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Register a prospect quote as an internal customer.",
  })
  @ApiParam({ name: "quoteId", format: "uuid" })
  @ApiBody({ type: RegisterQuoteProspectBodyDto })
  @ApiCreatedResponse({
    description: "Quote prospect registered successfully.",
    type: RegisterQuoteProspectResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid payload or quote/customer conversion rule.",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({
    description:
      "Authenticated user does not have the required role or employee feature.",
  })
  @ApiNotFoundResponse({ description: "Quote or establishment not found." })
  @ApiConflictResponse({
    description: "Customer already registered for the establishment.",
  })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("quoteId", new QuoteZodValidationPipe(quoteIdParamSchema))
    quoteId: string,
    @Body(new QuoteZodValidationPipe(registerQuoteProspectBodySchema))
    body: RegisterQuoteProspectBodySchema,
  ) {
    const result = await this.registerQuoteProspectAsCustomer.execute({
      actor: { userId: user.userId, role: user.role },
      quoteId,
      email: body.email,
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.birthDate !== undefined ? { birthDate: body.birthDate } : {}),
      ...(body.nickname !== undefined ? { nickname: body.nickname } : {}),
      createVehicleFromQuote: body.createVehicleFromQuote ?? false,
    });

    if (result.isLeft()) {
      throwQuoteHttpError(result.value);
    }

    return {
      customer: CustomerPresenter.toHTTP(result.value.customer),
      vehicle: result.value.vehicle
        ? CustomerVehiclePresenter.toHTTP(result.value.vehicle)
        : null,
      quote: QuotePresenter.toHTTP(result.value.quote),
    };
  }
}
