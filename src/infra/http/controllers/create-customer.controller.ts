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
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiTags,
} from "@nestjs/swagger";
import z from "zod";

import { CreateCustomerUseCase } from "../../../modules/application/use-cases/customer/create-customer";
import { Customer } from "../../../modules/customer/domain/entities/customer";
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

const createCustomerBodySchema = z.object({
  cpfCnpj: z.string().trim().optional().nullable(),
  fullName: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.email().trim(),
  address: z
    .object({
      street: z.string().trim().min(1),
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

export function customerToHTTP(customer: Customer) {
  return {
    id: customer.id.toString(),
    establishmentId: customer.establishmentId.toString(),
    cpfCnpj: customer.cpfCnpj?.toString() ?? null,
    documentType: customer.cpfCnpj?.type ?? null,
    fullName: customer.fullName,
    phone: customer.phone.toString(),
    email: customer.email.toString(),
    address: customer.address
      ? {
          street: customer.address.street,
          country: customer.address.country,
          state: customer.address.state,
          zipCode: customer.address.zipCode,
          city: customer.address.city,
        }
      : null,
    birthDate: customer.birthDate?.toISOString() ?? null,
    nickname: customer.nickname,
    deletedAt: customer.deletedAt?.toISOString() ?? null,
    createdAt: customer.createdAt?.toISOString() ?? null,
    updatedAt: customer.updatedAt?.toISOString() ?? null,
  };
}

@ApiTags("customers")
@ApiBearerAuth("access-token")
@Controller("/customers")
@Roles(["ESTABLISHMENT"])
export class CreateCustomerController {
  constructor(private readonly createCustomer: CreateCustomerUseCase) {}

  @Post()
  @ApiBody({ type: CreateCustomerBodyDto })
  @ApiCreatedResponse({ type: CustomerResponseDto })
  @ApiConflictResponse({
    description: "Customer document already exists for this establishment.",
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
      customer: customerToHTTP(result.value.customer),
    };
  }
}
