import {
  Controller,
  Delete,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";
import { DeleteEmployeeUseCase } from "../../../modules/application/use-cases/employee/delete-employee";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const employeeIdParamSchema = z.uuid();

@ApiTags("employees")
@ApiBearerAuth("access-token")
@Controller("/employees/:employeeId")
@Roles(["ESTABLISHMENT"])
export class DeleteEmployeeController {
  constructor(private readonly deleteEmployee: DeleteEmployeeUseCase) {}

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: "Soft-delete an employee." })
  @ApiParam({ name: "employeeId", format: "uuid" })
  @ApiNoContentResponse({ description: "Employee deleted successfully." })
  @ApiBadRequestResponse({ description: "Invalid employee id." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({
    description: "Authenticated user is not establishment.",
  })
  @ApiNotFoundResponse({ description: "Employee not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("employeeId", new ZodValidationPipe(employeeIdParamSchema))
    employeeId: string,
  ) {
    const result = await this.deleteEmployee.execute({
      establishmentOwnerId: user.userId,
      employeeId,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new InternalServerErrorException(error.message);
      }
    }
  }
}
