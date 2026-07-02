import { Body, Controller, Param, Patch } from "@nestjs/common";
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
import z from "zod";

import { UpdateQuoteUseCase } from "../../../../modules/application/use-cases/quote/update-quote";
import { AuthenticatedUser } from "../../../auth/authenticated-user";
import { CurrentUser } from "../../../auth/current-user";
import { EmployeeFeatures } from "../../../auth/employee-features";
import { Roles } from "../../../auth/roles";
import {
  QuoteResponseDto,
  UpdateQuoteBodyDto,
} from "../../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe";
import { QuotePresenter } from "../../presenters/quote-presenter";
import { throwQuoteHttpError } from "./quote-http-errors";

const quoteAddressSchema = z.object({
  street: z.string().trim().nullable(),
  country: z.string().trim().nullable(),
  state: z.string().trim().nullable(),
  zipCode: z.string().trim().nullable(),
  city: z.string().trim().nullable(),
  complement: z.string().trim().optional().nullable(),
});

const quoteCustomerSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional().nullable(),
  cpfCnpj: z.string().trim().optional().nullable(),
  address: quoteAddressSchema.optional().nullable(),
});

const quoteVehicleSchema = z.object({
  plate: z.string().trim().optional().nullable(),
  brand: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable(),
  color: z.string().trim().optional().nullable(),
  year: z.number().int().optional().nullable(),
});

const quotePaymentOptionSchema = z.object({
  method: z.enum(["CASH", "PIX", "CARD", "OTHER"]),
  label: z.string().trim().min(1),
  installments: z.number().int().positive().optional().nullable(),
  interestFree: z.boolean().optional().nullable(),
  discountType: z.enum(["PERCENTAGE", "AMOUNT"]).optional().nullable(),
  discountValue: z.number().int().nonnegative().optional().nullable(),
});

const updateQuoteBodySchema = z
  .object({
    customerId: z.uuid().optional(),
    customer: quoteCustomerSchema.optional(),
    vehicleId: z.uuid().optional(),
    vehicle: quoteVehicleSchema.optional(),
    serviceItems: z
      .array(
        z.object({
          serviceId: z.uuid(),
          isCourtesy: z.boolean().optional(),
        }),
      )
      .min(1)
      .optional(),
    paymentOptions: z.array(quotePaymentOptionSchema).min(1).optional(),
    description: z.string().trim().optional().nullable(),
    termsAndConditions: z.string().trim().optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
  })
  .refine(
    (value) => !(value.customerId !== undefined && value.customer !== undefined),
    "Provide either customerId or customer.",
  )
  .refine(
    (value) => !(value.vehicleId !== undefined && value.vehicle !== undefined),
    "Provide either vehicleId or vehicle.",
  )
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field must be provided.",
  );

type UpdateQuoteBodySchema = z.infer<typeof updateQuoteBodySchema>;
const quoteIdParamSchema = z.uuid();

@ApiTags("quotes")
@ApiBearerAuth("access-token")
@Controller("/quotes/:quoteId")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["update:quotes"])
export class UpdateQuoteController {
  constructor(private readonly updateQuote: UpdateQuoteUseCase) {}

  @Patch()
  @ApiOperation({
    summary: "Update a commercial quote for the authenticated establishment.",
    description:
      "Partially updates top-level quote sections. Sent customer, vehicle, service, and payment sections replace that section.",
  })
  @ApiParam({
    name: "quoteId",
    description: "Quote identifier.",
    format: "uuid",
  })
  @ApiBody({ type: UpdateQuoteBodyDto })
  @ApiOkResponse({
    description: "Quote updated successfully.",
    type: QuoteResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, expired or approved quote, stale services with isolated payment update, inactive service, or invalid quote rules.",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({
    description:
      "Authenticated user does not have the required role or employee feature.",
  })
  @ApiNotFoundResponse({
    description:
      "Quote, customer, vehicle, service, or establishment profile was not found.",
  })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("quoteId", new ZodValidationPipe(quoteIdParamSchema))
    quoteId: string,
    @Body(new ZodValidationPipe(updateQuoteBodySchema))
    body: UpdateQuoteBodySchema,
  ) {
    const customerAddress =
      body.customer?.address !== undefined && body.customer.address !== null
        ? {
            street: body.customer.address.street,
            country: body.customer.address.country,
            state: body.customer.address.state,
            zipCode: body.customer.address.zipCode,
            city: body.customer.address.city,
            complement: body.customer.address.complement ?? null,
          }
        : body.customer?.address;
    const customer =
      body.customer !== undefined
        ? {
            name: body.customer.name,
            ...(body.customer.phone !== undefined
              ? { phone: body.customer.phone }
              : {}),
            ...(body.customer.cpfCnpj !== undefined
              ? { cpfCnpj: body.customer.cpfCnpj }
              : {}),
            ...(customerAddress !== undefined
              ? { address: customerAddress }
              : {}),
          }
        : undefined;
    const vehicle =
      body.vehicle !== undefined
        ? {
            ...(body.vehicle.plate !== undefined
              ? { plate: body.vehicle.plate }
              : {}),
            ...(body.vehicle.brand !== undefined
              ? { brand: body.vehicle.brand }
              : {}),
            ...(body.vehicle.model !== undefined
              ? { model: body.vehicle.model }
              : {}),
            ...(body.vehicle.color !== undefined
              ? { color: body.vehicle.color }
              : {}),
            ...(body.vehicle.year !== undefined
              ? { year: body.vehicle.year }
              : {}),
          }
        : undefined;
    const serviceItems = body.serviceItems?.map((item) => ({
      serviceId: item.serviceId,
      ...(item.isCourtesy !== undefined ? { isCourtesy: item.isCourtesy } : {}),
    }));
    const paymentOptions = body.paymentOptions?.map((option) => ({
      method: option.method,
      label: option.label,
      ...(option.installments !== undefined
        ? { installments: option.installments }
        : {}),
      ...(option.interestFree !== undefined
        ? { interestFree: option.interestFree }
        : {}),
      ...(option.discountType !== undefined
        ? { discountType: option.discountType }
        : {}),
      ...(option.discountValue !== undefined
        ? { discountValue: option.discountValue }
        : {}),
    }));

    const result = await this.updateQuote.execute({
      actor: { userId: user.userId, role: user.role },
      quoteId,
      ...(body.customerId !== undefined ? { customerId: body.customerId } : {}),
      ...(customer !== undefined ? { customer } : {}),
      ...(body.vehicleId !== undefined ? { vehicleId: body.vehicleId } : {}),
      ...(vehicle !== undefined ? { vehicle } : {}),
      ...(serviceItems !== undefined ? { serviceItems } : {}),
      ...(paymentOptions !== undefined ? { paymentOptions } : {}),
      ...(body.description !== undefined
        ? { description: body.description }
        : {}),
      ...(body.termsAndConditions !== undefined
        ? { termsAndConditions: body.termsAndConditions }
        : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
    });

    if (result.isLeft()) {
      throwQuoteHttpError(result.value);
    }

    return {
      quote: QuotePresenter.toHTTP(result.value.quote),
    };
  }
}
