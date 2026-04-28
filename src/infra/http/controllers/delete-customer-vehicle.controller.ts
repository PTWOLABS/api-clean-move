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

import { DeleteCustomerVehicleUseCase } from "../../../modules/application/use-cases/customer/delete-customer-vehicle";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import z from "zod";

const customerIdParamSchema = z.uuid();
const vehicleIdParamSchema = z.uuid();

@ApiTags("customer vehicles")
@ApiBearerAuth("access-token")
@Controller("/customers/:customerId/vehicles/:vehicleId")
@Roles(["ESTABLISHMENT"])
export class DeleteCustomerVehicleController {
  constructor(
    private readonly deleteCustomerVehicle: DeleteCustomerVehicleUseCase,
  ) {}

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary: "Soft-delete a vehicle for an internal customer.",
    description:
      "Soft-deletes a vehicle after validating customer, vehicle, and establishment ownership. Deleted vehicles cannot be used in new appointments.",
  })
  @ApiParam({
    name: "customerId",
    description: "Customer identifier.",
    format: "uuid",
  })
  @ApiParam({
    name: "vehicleId",
    description: "Customer vehicle identifier.",
    format: "uuid",
  })
  @ApiNoContentResponse({ description: "Vehicle deleted successfully." })
  @ApiBadRequestResponse({
    description: "Invalid customer id or vehicle id.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description: "Authenticated user does not have the establishment role.",
  })
  @ApiNotFoundResponse({
    description:
      "Customer or vehicle was not found for the authenticated establishment, or the establishment profile does not exist.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while deleting the customer vehicle.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("customerId", new ZodValidationPipe(customerIdParamSchema))
    customerId: string,
    @Param("vehicleId", new ZodValidationPipe(vehicleIdParamSchema))
    vehicleId: string,
  ) {
    const result = await this.deleteCustomerVehicle.execute({
      establishmentOwnerId: user.userId,
      customerId,
      vehicleId,
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
