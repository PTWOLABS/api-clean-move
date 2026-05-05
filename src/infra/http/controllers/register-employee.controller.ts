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
import { RegisterEmployeeUseCase } from "../../../modules/application/use-cases/employee/register-employee";
import { InvalidRegisterEmployeeInputError } from "../../../modules/employees/domain/errors/invalid-register-employee-input-error";
import { ALLOWED_EXTRA_EMPLOYEE_FEATURES } from "../../../modules/employees/domain/policies/employee-features-policy";
import { ResourceAlreadyExistsError } from "../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  RegisterEmployeeBodyDto,
  RegisterEmployeeResponseDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { EmployeePresenter } from "../presenters/employee-presenter";

const registerEmployeeBodySchema = z
  .object({
    name: z.string().trim().min(1),
    email: z.email().trim(),
    password: z.string().nonempty().max(72),
    cpf: z.string().trim().optional().nullable(),
    birthDate: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional()
      .nullable(),
    extraFeatures: z
      .array(z.enum(ALLOWED_EXTRA_EMPLOYEE_FEATURES))
      .optional()
      .default([]),
  })
  .strict();

type RegisterEmployeeBodySchema = z.infer<typeof registerEmployeeBodySchema>;

@ApiTags("employees")
@ApiBearerAuth("access-token")
@Controller("/employees")
@Roles(["ESTABLISHMENT"])
export class RegisterEmployeeController {
  constructor(private readonly registerEmployee: RegisterEmployeeUseCase) {}

  @Post()
  @ApiOperation({
    summary: "Register an employee for the authenticated establishment.",
  })
  @ApiBody({ type: RegisterEmployeeBodyDto })
  @ApiCreatedResponse({
    description: "Employee registered successfully.",
    type: RegisterEmployeeResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, invalid email, invalid CPF, invalid birth date, or invalid employee feature.",
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
    description: "Employee email already exists.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while registering the employee.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(registerEmployeeBodySchema))
    body: RegisterEmployeeBodySchema,
  ) {
    const result = await this.registerEmployee.execute({
      establishmentOwnerId: user.userId,
      name: body.name,
      email: body.email,
      password: body.password,
      extraFeatures: body.extraFeatures,
      ...(body.cpf !== undefined ? { cpf: body.cpf } : {}),
      ...(body.birthDate !== undefined ? { birthDate: body.birthDate } : {}),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceAlreadyExistsError:
          throw new ConflictException(error.message);
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case InvalidRegisterEmployeeInputError:
          throw new BadRequestException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new BadRequestException(error.message);
      }
    }

    return {
      employee: EmployeePresenter.toHTTP(result.value.employee),
    };
  }
}
