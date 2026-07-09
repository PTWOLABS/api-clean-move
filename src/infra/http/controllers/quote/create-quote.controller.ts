import { Body, Controller, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { CreateQuoteUseCase } from "../../../../modules/application/use-cases/quote/create-quote";
import { AuthenticatedUser } from "../../../auth/authenticated-user";
import { CurrentUser } from "../../../auth/current-user";
import { EmployeeFeatures } from "../../../auth/employee-features";
import { Roles } from "../../../auth/roles";
import {
  CreateQuoteBodyDto,
  QuoteResponseDto,
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
  complement: z.string().trim().nullable(),
});

const quoteCustomerSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional().nullable(),
  cpfCnpj: z.string().trim().optional().nullable(),
  address: quoteAddressSchema.optional().nullable(),
});

const quoteVehicleSchema = z.object({
  plate: z.string().trim().optional().nullable(),
  brand: z.string().trim().min(1),
  model: z.string().trim().min(1),
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

const quoteServiceItemSchema = z
  .object({
    serviceId: z.uuid().optional().nullable(),
    serviceName: z.string().trim().min(1).optional(),
    priceInCents: z.number().int().nonnegative().optional(),
    isCourtesy: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.serviceId) {
      if (value.serviceName !== undefined) {
        context.addIssue({
          code: "custom",
          message: "serviceName cannot be provided with serviceId.",
          path: ["serviceName"],
        });
      }

      return;
    }

    if (!value.serviceName) {
      context.addIssue({
        code: "custom",
        message: "serviceName is required when serviceId is not provided.",
        path: ["serviceName"],
      });
    }

    if (value.priceInCents === undefined) {
      context.addIssue({
        code: "custom",
        message: "priceInCents is required when serviceId is not provided.",
        path: ["priceInCents"],
      });
    }
  });

const createQuoteBodySchema = z
  .object({
    customerId: z.uuid().optional().nullable(),
    customer: quoteCustomerSchema.optional(),
    vehicleId: z.uuid().optional().nullable(),
    vehicle: quoteVehicleSchema.optional().nullable(),
    serviceItems: z.array(quoteServiceItemSchema).min(1),
    paymentOptions: z.array(quotePaymentOptionSchema).min(1),
    description: z.string().trim().optional().nullable(),
    termsAndConditions: z.string().trim().optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
  })
  .superRefine((value, context) => {
    if (value.customerId && value.customer !== undefined) {
      context.addIssue({
        code: "custom",
        message: "customer cannot be provided with customerId.",
        path: ["customer"],
      });
    }

    if (
      value.vehicleId &&
      value.vehicle !== undefined &&
      value.vehicle !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "vehicle cannot be provided with vehicleId.",
        path: ["vehicle"],
      });
    }
  });

type CreateQuoteBodySchema = z.infer<typeof createQuoteBodySchema>;

@ApiTags("quotes")
@ApiBearerAuth("access-token")
@Controller("/quotes")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["create:quotes"])
export class CreateQuoteController {
  constructor(private readonly createQuote: CreateQuoteUseCase) {}

  @Post()
  @ApiOperation({
    summary: "Create a commercial quote for the authenticated establishment.",
  })
  @ApiBody({ type: CreateQuoteBodyDto })
  @ApiCreatedResponse({
    description: "Quote created successfully.",
    type: QuoteResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid payload, inactive service, or invalid quote rules.",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({
    description:
      "Authenticated user does not have the required role or employee feature.",
  })
  @ApiNotFoundResponse({
    description:
      "Customer, vehicle, service, owner, or establishment profile was not found.",
  })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createQuoteBodySchema))
    body: CreateQuoteBodySchema,
  ) {
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
            ...(body.customer.address !== undefined
              ? { address: body.customer.address }
              : {}),
          }
        : undefined;
    const vehicle =
      body.vehicle !== undefined && body.vehicle !== null
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
        : body.vehicle;
    const serviceItems = body.serviceItems.map((item) => ({
      ...(item.serviceId !== undefined && item.serviceId !== null
        ? { serviceId: item.serviceId }
        : {}),
      ...(item.serviceName !== undefined
        ? { serviceName: item.serviceName }
        : {}),
      ...(item.priceInCents !== undefined
        ? { priceInCents: item.priceInCents }
        : {}),
      ...(item.isCourtesy !== undefined ? { isCourtesy: item.isCourtesy } : {}),
    }));
    const paymentOptions = body.paymentOptions.map((option) => ({
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

    const result = await this.createQuote.execute({
      actor: { userId: user.userId, role: user.role },
      serviceItems,
      paymentOptions,
      ...(body.customerId !== undefined ? { customerId: body.customerId } : {}),
      ...(customer !== undefined ? { customer } : {}),
      ...(body.vehicleId !== undefined ? { vehicleId: body.vehicleId } : {}),
      ...(vehicle !== undefined ? { vehicle } : {}),
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
