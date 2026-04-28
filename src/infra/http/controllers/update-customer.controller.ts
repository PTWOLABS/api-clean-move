import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import z from "zod";

import { UpdateCustomerUseCase } from "../../../modules/application/use-cases/customer/update-customer";
import { ResourceAlreadyExistsError } from "../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  CustomerResponseDto,
  UpdateCustomerBodyDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { CustomerPresenter } from "../presenters/customer-presenter";

const updateCustomerBodySchema = z
  .object({
    cpfCnpj: z.string().trim().optional().nullable(),
    fullName: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).optional(),
    email: z.email().trim().optional(),
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
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field must be provided.",
  );

type UpdateCustomerBodySchema = z.infer<typeof updateCustomerBodySchema>;
const customerIdParamSchema = z.uuid();

@ApiTags("customers")
@ApiBearerAuth("access-token")
@Controller("/customers/:customerId")
@Roles(["ESTABLISHMENT"])
export class UpdateCustomerController {
  constructor(private readonly updateCustomer: UpdateCustomerUseCase) {}

  @Patch()
  @ApiBody({ type: UpdateCustomerBodyDto })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiConflictResponse({
    description: "Customer document already exists for this establishment.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("customerId", new ZodValidationPipe(customerIdParamSchema))
    customerId: string,
    @Body(new ZodValidationPipe(updateCustomerBodySchema))
    body: UpdateCustomerBodySchema,
  ) {
    const result = await this.updateCustomer.execute({
      establishmentOwnerId: user.userId,
      customerId,
      ...(body.cpfCnpj !== undefined ? { cpfCnpj: body.cpfCnpj } : {}),
      ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
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
