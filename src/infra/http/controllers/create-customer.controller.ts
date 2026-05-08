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

import { CreateCustomerUseCase } from "../../../modules/application/use-cases/customer/create-customer";
import { ResourceAlreadyExistsError } from "../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  CreateCustomerBodyDto,
  CustomerResponseDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { CustomerPresenter } from "../presenters/customer-presenter";

const createCustomerBodySchema = z.object({
  cpfCnpj: z.string().trim().optional().nullable(),
  fullName: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.email().trim(),
  address: z
    .object({
      street: z.string().trim().min(1),
      complement: z.string().trim().optional().nullable(),
      country: z.string().trim().min(1),
      state: z.string().trim().min(1),
      zipCode: z.string().trim().min(1),
      city: z.string().trim().min(1),
    })
    .optional()
    .nullable(),
  birthDate: z.coerce.date().optional().nullable(),
  nickname: z.string().trim().optional().nullable(),
});

type CreateCustomerBodySchema = z.infer<typeof createCustomerBodySchema>;

@ApiTags("customers")
@ApiBearerAuth("access-token")
@Controller("/customers")
@Roles(["ESTABLISHMENT"])
export class CreateCustomerController {
  constructor(private readonly createCustomer: CreateCustomerUseCase) {}

  @Post()
  @ApiOperation({
    summary: "Create an internal customer for the authenticated establishment.",
    description:
      "Creates a customer record scoped to the establishment owned by the authenticated user. The customer is not an application user and cannot authenticate.",
  })
  @ApiBody({ type: CreateCustomerBodyDto })
  @ApiCreatedResponse({
    description: "Customer created successfully.",
    type: CustomerResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, invalid document, invalid email, invalid phone, or invalid optional address/date fields.",
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
    description: "Customer document already exists for this establishment.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while creating the customer.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCustomerBodySchema))
    body: CreateCustomerBodySchema,
  ) {
    const result = await this.createCustomer.execute({
      establishmentOwnerId: user.userId,
      fullName: body.fullName,
      phone: body.phone,
      email: body.email,
      ...(body.cpfCnpj !== undefined ? { cpfCnpj: body.cpfCnpj } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.birthDate !== undefined ? { birthDate: body.birthDate } : {}),
      ...(body.nickname !== undefined ? { nickname: body.nickname } : {}),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceAlreadyExistsError:
          throw new ConflictException(error.message);
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new BadRequestException(error.message);
      }
    }

    return {
      customer: CustomerPresenter.toHTTP(result.value.customer),
    };
  }
}
