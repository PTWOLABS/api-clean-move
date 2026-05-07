import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
} from "@nestjs/common";
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
import { UpdateEmployeeUseCase } from "../../../modules/application/use-cases/employee/update-employee";
import { InvalidRegisterEmployeeInputError } from "../../../modules/employees/domain/errors/invalid-register-employee-input-error";
import { ALLOWED_EXTRA_EMPLOYEE_FEATURES } from "../../../modules/employees/domain/policies/employee-features-policy";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { EmployeeFeatures } from "../../auth/employee-features";
import { Roles } from "../../auth/roles";
import {
  EmployeeResponseDto,
  UpdateEmployeeBodyDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { EmployeePresenter } from "../presenters/employee-presenter";

const updateEmployeeBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    birthDate: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional()
      .nullable(),
    extraFeatures: z.array(z.enum(ALLOWED_EXTRA_EMPLOYEE_FEATURES)).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field must be provided.",
  );

type UpdateEmployeeBodySchema = z.infer<typeof updateEmployeeBodySchema>;
const employeeIdParamSchema = z.uuid();

@ApiTags("employees")
@ApiBearerAuth("access-token")
@Controller("/employees/:employeeId")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["update:employees:self"])
export class UpdateEmployeeController {
  constructor(private readonly updateEmployee: UpdateEmployeeUseCase) {}

  @Patch()
  @ApiOperation({ summary: "Update employee data." })
  @ApiParam({ name: "employeeId", format: "uuid" })
  @ApiBody({ type: UpdateEmployeeBodyDto })
  @ApiOkResponse({ type: EmployeeResponseDto })
  @ApiBadRequestResponse({ description: "Invalid payload." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({ description: "Missing employee feature." })
  @ApiNotFoundResponse({ description: "Employee not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("employeeId", new ZodValidationPipe(employeeIdParamSchema))
    employeeId: string,
    @Body(new ZodValidationPipe(updateEmployeeBodySchema))
    body: UpdateEmployeeBodySchema,
  ) {
    const result = await this.updateEmployee.execute({
      actor: {
        userId: user.userId,
        role: user.role,
      },
      employeeId,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.birthDate !== undefined ? { birthDate: body.birthDate } : {}),
      ...(body.extraFeatures !== undefined
        ? { extraFeatures: body.extraFeatures }
        : {}),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case NotAllowedError:
          throw new ForbiddenException(error.message);
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
