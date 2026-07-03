import {
  Controller,
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

import { GetCustomerVehicleUseCase } from "../../../modules/application/use-cases/customer/get-customer-vehicle";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { CustomerVehicleResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { CustomerVehiclePresenter } from "../presenters/customer-vehicle-presenter";

const customerIdParamSchema = z.uuid();
const vehicleIdParamSchema = z.uuid();

@ApiTags("customer vehicles")
@ApiBearerAuth("access-token")
@Controller("/customers/:customerId/vehicles/:vehicleId")
@Roles(["ESTABLISHMENT"])
export class GetCustomerVehicleController {
  constructor(private readonly getCustomerVehicle: GetCustomerVehicleUseCase) {}

  @Get()
  @ApiOperation({
    summary: "Get an active vehicle for an internal customer.",
    description:
      "Returns a single active vehicle linked to a customer owned by the authenticated establishment.",
  })
  @ApiParam({
    name: "customerId",
    description: "Customer identifier.",
    format: "uuid",
  })
  @ApiParam({
    name: "vehicleId",
    description: "Vehicle identifier.",
    format: "uuid",
  })
  @ApiOkResponse({
    description: "Customer vehicle fetched successfully.",
    type: CustomerVehicleResponseDto,
  })
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
    description: "Unexpected failure while fetching the customer vehicle.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("customerId", new ZodValidationPipe(customerIdParamSchema))
    customerId: string,
    @Param("vehicleId", new ZodValidationPipe(vehicleIdParamSchema))
    vehicleId: string,
  ) {
    const result = await this.getCustomerVehicle.execute({
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

    return {
      vehicle: CustomerVehiclePresenter.toHTTP(result.value.vehicle),
    };
  }
}
