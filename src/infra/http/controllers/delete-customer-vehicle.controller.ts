import {
  Controller,
  Delete,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
} from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from "@nestjs/swagger";

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
  @ApiNoContentResponse({ description: "Vehicle deleted successfully." })
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
