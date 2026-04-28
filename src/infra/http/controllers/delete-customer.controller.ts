import {
  Controller,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Delete,
} from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from "@nestjs/swagger";

import { DeleteCustomerUseCase } from "../../../modules/application/use-cases/customer/delete-customer";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import z from "zod";

const customerIdParamSchema = z.uuid();

@ApiTags("customers")
@ApiBearerAuth("access-token")
@Controller("/customers/:customerId")
@Roles(["ESTABLISHMENT"])
export class DeleteCustomerController {
  constructor(private readonly deleteCustomer: DeleteCustomerUseCase) {}

  @Delete()
  @HttpCode(204)
  @ApiNoContentResponse({ description: "Customer deleted successfully." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("customerId", new ZodValidationPipe(customerIdParamSchema))
    customerId: string,
  ) {
    const result = await this.deleteCustomer.execute({
      establishmentOwnerId: user.userId,
      customerId,
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
