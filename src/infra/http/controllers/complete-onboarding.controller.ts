import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Post,
} from "@nestjs/common";
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
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import {
  CompleteOnboardingUseCase,
  InvalidOnboardingInputError,
} from "../../../modules/application/use-cases/onboarding/complete-onboarding";
import { ResourceAlreadyExistsError } from "../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { hasAnyProvidedValue } from "../../../shared/utils/has-any-provided-value";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  CompleteOnboardingBodyDto,
  CompleteOnboardingResponseDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const onboardingBodySchema = z
  .object({
    establishment: z
      .object({
        tradeName: z.string().trim().min(1).optional(),
        legalBusinessName: z.string().trim().min(1).optional(),
        cnpj: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
    service: z
      .object({
        serviceName: z.string().trim().min(1).optional(),
        description: z.string().trim().optional(),
        categoryId: z.uuid().optional(),
        estimatedDuration: z
          .object({
            minInMinutes: z.coerce.number().int().positive().optional(),
            maxInMinutes: z.coerce.number().int().positive().optional(),
          })
          .strict()
          .optional(),
        price: z.number().positive().optional(),
        isActive: z.boolean().optional(),
      })
      .strict()
      .optional(),
    customer: z
      .object({
        cpfCnpj: z.string().trim().optional().nullable(),
        fullName: z.string().trim().min(1).optional(),
        phone: z.string().trim().min(1).optional(),
        email: z.email().trim().optional().nullable(),
        address: z
          .object({
            street: z.string().trim().min(1),
            complement: z.string().trim().optional().nullable(),
            country: z.string().trim().min(1),
            state: z.string().trim().min(1),
            zipCode: z.string().trim().min(1),
            city: z.string().trim().min(1),
          })
          .strict()
          .optional()
          .nullable(),
        birthDate: z.coerce.date().optional().nullable(),
        nickname: z.string().trim().optional().nullable(),
      })
      .strict()
      .optional(),
    vehicle: z
      .object({
        plate: z.string().trim().optional().nullable(),
        brand: z.string().trim().optional().nullable(),
        model: z.string().trim().optional().nullable(),
        color: z.string().trim().optional().nullable(),
        year: z.number().int().optional().nullable(),
        notes: z.string().trim().optional().nullable(),
      })
      .strict()
      .optional(),
    appointment: z
      .object({
        startsAt: z.coerce.date().optional(),
        endsAt: z.coerce.date().optional().nullable(),
        description: z.string().trim().optional().nullable(),
        discountInCents: z.number().int().nonnegative().optional().nullable(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    const hasServiceData = hasAnyProvidedValue(body.service);
    const hasCustomerData = hasAnyProvidedValue(body.customer);
    const hasVehicleData = hasAnyProvidedValue(body.vehicle);
    const hasAppointmentData = hasAnyProvidedValue(body.appointment);

    if (hasServiceData) {
      if (body.service?.serviceName === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Required when service data is provided.",
          path: ["service", "serviceName"],
        });
      }

      if (body.service?.price === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Required when service data is provided.",
          path: ["service", "price"],
        });
      }

      if (body.service?.categoryId === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Required when service data is provided.",
          path: ["service", "categoryId"],
        });
      }

      if (body.service?.estimatedDuration?.minInMinutes === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Required when service data is provided.",
          path: ["service", "estimatedDuration", "minInMinutes"],
        });
      }
    }

    if (hasVehicleData && !hasCustomerData) {
      ctx.addIssue({
        code: "custom",
        message: "Vehicle data requires customer data.",
        path: ["vehicle"],
      });
    }

    if (hasCustomerData) {
      if (body.customer?.fullName === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Required when customer data is provided.",
          path: ["customer", "fullName"],
        });
      }

      if (body.customer?.phone === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Required when customer data is provided.",
          path: ["customer", "phone"],
        });
      }
    }

    if (hasAppointmentData) {
      if (!hasServiceData || !hasCustomerData) {
        ctx.addIssue({
          code: "custom",
          message: "Appointment data requires service and customer data.",
          path: ["appointment"],
        });
      }

      if (body.appointment?.startsAt === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Required when appointment data is provided.",
          path: ["appointment", "startsAt"],
        });
      }
    }
  });

type OnboardingBodySchema = z.infer<typeof onboardingBodySchema>;

@ApiTags("onboarding")
@ApiBearerAuth("access-token")
@Controller("/onboarding")
@Roles(["ESTABLISHMENT"])
export class CompleteOnboardingController {
  constructor(private readonly completeOnboarding: CompleteOnboardingUseCase) {}

  @Post()
  @ApiOperation({
    summary:
      "Complete establishment onboarding with optional profile, service, customer, and vehicle data.",
  })
  @ApiBody({ type: CompleteOnboardingBodyDto })
  @ApiCreatedResponse({
    description: "Onboarding data processed successfully.",
    type: CompleteOnboardingResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload or incomplete conditional onboarding section.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description: "Authenticated user does not have the establishment role.",
  })
  @ApiNotFoundResponse({
    description:
      "The authenticated establishment user does not have an establishment profile.",
  })
  @ApiConflictResponse({
    description: "CNPJ, customer document, or vehicle plate already exists.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while completing onboarding.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(onboardingBodySchema))
    body: OnboardingBodySchema,
  ) {
    const result = await this.completeOnboarding.execute({
      establishmentOwnerId: user.userId,
      ...(body.establishment !== undefined
        ? { establishment: body.establishment }
        : {}),
      ...(body.service !== undefined ? { service: body.service } : {}),
      ...(body.customer !== undefined ? { customer: body.customer } : {}),
      ...(body.vehicle !== undefined ? { vehicle: body.vehicle } : {}),
      ...(body.appointment !== undefined
        ? { appointment: body.appointment }
        : {}),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceAlreadyExistsError:
          throw new ConflictException(error.message);
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case InvalidOnboardingInputError:
          throw new BadRequestException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new BadRequestException(error.message);
      }
    }

    return {
      onboarding: {
        establishmentUpdated: hasAnyProvidedValue(body.establishment),
        serviceCreated: result.value.service !== null,
        customerCreated: result.value.customer !== null,
        vehicleCreated: result.value.vehicle !== null,
        appointmentCreated: result.value.appointment !== null,
      },
    };
  }
}
