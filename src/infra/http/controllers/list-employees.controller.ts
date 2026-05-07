import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";
import { ListEmployeesUseCase } from "../../../modules/application/use-cases/employee/list-employees";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ListEmployeesResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { EmployeePresenter } from "../presenters/employee-presenter";

const listEmployeesQuerySchema = z.object({
  name: z.string().trim().optional(),
});

type ListEmployeesQuerySchema = z.infer<typeof listEmployeesQuerySchema>;

@ApiTags("employees")
@ApiBearerAuth("access-token")
@Controller("/employees")
@Roles(["ESTABLISHMENT"])
export class ListEmployeesController {
  constructor(private readonly listEmployees: ListEmployeesUseCase) {}

  @Get()
  @ApiOperation({ summary: "List active employees by establishment." })
  @ApiQuery({ name: "name", required: false, type: String })
  @ApiOkResponse({ type: ListEmployeesResponseDto })
  @ApiBadRequestResponse({ description: "Invalid query params." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({
    description: "Authenticated user is not establishment.",
  })
  @ApiNotFoundResponse({ description: "Establishment profile not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listEmployeesQuerySchema))
    query: ListEmployeesQuerySchema,
  ) {
    const result = await this.listEmployees.execute({
      establishmentOwnerId: user.userId,
      ...(query.name !== undefined ? { name: query.name } : {}),
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

    return {
      employees: result.value.employees.map((employee) =>
        EmployeePresenter.toHTTP(employee),
      ),
    };
  }
}
