import {
  Controller,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Delete,
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
  @ApiOperation({
    summary: "Soft-delete an internal customer.",
    description:
      "Soft-deletes a customer after validating that it belongs to the authenticated establishment. Deleted customers are excluded from active listings and cannot be used in new appointments.",
  })
  @ApiParam({
    name: "customerId",
    description: "Customer identifier.",
    format: "uuid",
  })
  @ApiNoContentResponse({ description: "Customer deleted successfully." })
  @ApiBadRequestResponse({
    description: "Invalid customer id.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description: "Authenticated user does not have the establishment role.",
  })
  @ApiNotFoundResponse({
    description:
      "Customer was not found for the authenticated establishment, or the establishment profile does not exist.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while deleting the customer.",
  })
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
