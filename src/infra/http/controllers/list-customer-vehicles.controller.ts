import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import z from "zod";

import { ListCustomerVehiclesUseCase } from "../../../modules/application/use-cases/customer/list-customer-vehicles";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ListCustomerVehiclesResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { CustomerVehiclePresenter } from "../presenters/customer-vehicle-presenter";

const listCustomerVehiclesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  size: z.coerce.number().int().positive().optional(),
});

type ListCustomerVehiclesQuerySchema = z.infer<
  typeof listCustomerVehiclesQuerySchema
>;
const customerIdParamSchema = z.uuid();

@ApiTags("customer vehicles")
@ApiBearerAuth("access-token")
@Controller("/customers/:customerId/vehicles")
@Roles(["ESTABLISHMENT"])
export class ListCustomerVehiclesController {
  constructor(
    private readonly listCustomerVehicles: ListCustomerVehiclesUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ type: ListCustomerVehiclesResponseDto })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("customerId", new ZodValidationPipe(customerIdParamSchema))
    customerId: string,
    @Query(new ZodValidationPipe(listCustomerVehiclesQuerySchema))
    query: ListCustomerVehiclesQuerySchema,
  ) {
    const result = await this.listCustomerVehicles.execute({
      establishmentOwnerId: user.userId,
      customerId,
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.size !== undefined ? { size: query.size } : {}),
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
      vehicles: result.value.vehicles.map(CustomerVehiclePresenter.toHTTP),
    };
  }
}
