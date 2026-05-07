import {
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { GetEmployeeUseCase } from "../../../modules/application/use-cases/employee/get-employee";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { EmployeeFeatures } from "../../auth/employee-features";
import { Roles } from "../../auth/roles";
import { EmployeeResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { EmployeePresenter } from "../presenters/employee-presenter";

const employeeIdParamSchema = z.uuid();

@ApiTags("employees")
@ApiBearerAuth("access-token")
@Controller("/employees/:employeeId")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["read:employees:self"])
export class GetEmployeeController {
  constructor(private readonly getEmployee: GetEmployeeUseCase) {}

  @Get()
  @ApiOperation({ summary: "Get an employee by id." })
  @ApiParam({ name: "employeeId", format: "uuid" })
  @ApiOkResponse({ type: EmployeeResponseDto })
  @ApiBadRequestResponse({ description: "Invalid employee id." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({ description: "Missing employee feature." })
  @ApiNotFoundResponse({ description: "Employee not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("employeeId", new ZodValidationPipe(employeeIdParamSchema))
    employeeId: string,
  ) {
    const result = await this.getEmployee.execute({
      actor: {
        userId: user.userId,
        role: user.role,
      },
      employeeId,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case NotAllowedError:
          throw new ForbiddenException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new InternalServerErrorException(error.message);
      }
    }

    return {
      employee: EmployeePresenter.toHTTP(result.value.employee),
    };
  }
}
