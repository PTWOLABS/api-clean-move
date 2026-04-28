import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { CreateCustomerVehicleUseCase } from "../../../modules/application/use-cases/customer/create-customer-vehicle";
import { ResourceAlreadyExistsError } from "../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  CreateCustomerVehicleBodyDto,
  CustomerVehicleResponseDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { CustomerVehiclePresenter } from "../presenters/customer-vehicle-presenter";

const customerVehicleBodySchema = z.object({
  plate: z.string().trim().optional().nullable(),
  brand: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable(),
  color: z.string().trim().optional().nullable(),
  year: z.number().int().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

type CustomerVehicleBodySchema = z.infer<typeof customerVehicleBodySchema>;
const customerIdParamSchema = z.uuid();

@ApiTags("customer vehicles")
@ApiBearerAuth("access-token")
@Controller("/customers/:customerId/vehicles")
@Roles(["ESTABLISHMENT"])
export class CreateCustomerVehicleController {
  constructor(
    private readonly createCustomerVehicle: CreateCustomerVehicleUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create a vehicle for an internal customer.",
    description:
      "Creates a vehicle linked to an active customer owned by the authenticated establishment.",
  })
  @ApiParam({
    name: "customerId",
    description: "Customer identifier.",
    format: "uuid",
  })
  @ApiBody({ type: CreateCustomerVehicleBodyDto })
  @ApiCreatedResponse({
    description: "Customer vehicle created successfully.",
    type: CustomerVehicleResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid customer id, invalid payload, invalid plate, or invalid vehicle field value.",
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
  @ApiConflictResponse({
    description: "Vehicle plate already exists for this establishment.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while creating the customer vehicle.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("customerId", new ZodValidationPipe(customerIdParamSchema))
    customerId: string,
    @Body(new ZodValidationPipe(customerVehicleBodySchema))
    body: CustomerVehicleBodySchema,
  ) {
    const result = await this.createCustomerVehicle.execute({
      establishmentOwnerId: user.userId,
      customerId,
      ...(body.plate !== undefined ? { plate: body.plate } : {}),
      ...(body.brand !== undefined ? { brand: body.brand } : {}),
      ...(body.model !== undefined ? { model: body.model } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...(body.year !== undefined ? { year: body.year } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceAlreadyExistsError:
          throw new ConflictException(error.message);
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new BadRequestException(error.message);
      }
    }

    return {
      vehicle: CustomerVehiclePresenter.toHTTP(result.value.vehicle),
    };
  }
}
