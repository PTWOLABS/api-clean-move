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

import { GetCustomerUseCase } from "../../../modules/application/use-cases/customer/get-customer";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { CustomerResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { CustomerPresenter } from "../presenters/customer-presenter";

const customerIdParamSchema = z.uuid();

@ApiTags("customers")
@ApiBearerAuth("access-token")
@Controller("/customers/:customerId")
@Roles(["ESTABLISHMENT"])
export class GetCustomerController {
  constructor(private readonly getCustomer: GetCustomerUseCase) {}

  @Get()
  @ApiOperation({
    summary: "Get an active customer for the authenticated establishment.",
    description:
      "Returns a single active internal customer record without vehicle data.",
  })
  @ApiParam({
    name: "customerId",
    description: "Customer identifier.",
    format: "uuid",
  })
  @ApiOkResponse({
    description: "Customer fetched successfully.",
    type: CustomerResponseDto,
  })
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
    description: "Unexpected failure while fetching the customer.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("customerId", new ZodValidationPipe(customerIdParamSchema))
    customerId: string,
  ) {
    const result = await this.getCustomer.execute({
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

    return {
      customer: CustomerPresenter.toHTTP(result.value.customer),
    };
  }
}
