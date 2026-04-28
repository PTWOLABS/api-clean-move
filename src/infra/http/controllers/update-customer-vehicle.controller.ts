import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import z from "zod";

import { UpdateCustomerVehicleUseCase } from "../../../modules/application/use-cases/customer/update-customer-vehicle";
import { ResourceAlreadyExistsError } from "../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  CustomerVehicleResponseDto,
  UpdateCustomerVehicleBodyDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { CustomerVehiclePresenter } from "../presenters/customer-vehicle-presenter";

const updateCustomerVehicleBodySchema = z
  .object({
    plate: z.string().trim().optional().nullable(),
    brand: z.string().trim().optional().nullable(),
    model: z.string().trim().optional().nullable(),
    color: z.string().trim().optional().nullable(),
    year: z.number().int().optional().nullable(),
    notes: z.string().trim().optional().nullable(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field must be provided.",
  );

type UpdateCustomerVehicleBodySchema = z.infer<
  typeof updateCustomerVehicleBodySchema
>;
const customerIdParamSchema = z.uuid();
const vehicleIdParamSchema = z.uuid();

@ApiTags("customer vehicles")
@ApiBearerAuth("access-token")
@Controller("/customers/:customerId/vehicles/:vehicleId")
@Roles(["ESTABLISHMENT"])
export class UpdateCustomerVehicleController {
  constructor(
    private readonly updateCustomerVehicle: UpdateCustomerVehicleUseCase,
  ) {}

  @Patch()
  @ApiBody({ type: UpdateCustomerVehicleBodyDto })
  @ApiOkResponse({ type: CustomerVehicleResponseDto })
  @ApiConflictResponse({
    description: "Vehicle plate already exists for this establishment.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("customerId", new ZodValidationPipe(customerIdParamSchema))
    customerId: string,
    @Param("vehicleId", new ZodValidationPipe(vehicleIdParamSchema))
    vehicleId: string,
    @Body(new ZodValidationPipe(updateCustomerVehicleBodySchema))
    body: UpdateCustomerVehicleBodySchema,
  ) {
    const result = await this.updateCustomerVehicle.execute({
      establishmentOwnerId: user.userId,
      customerId,
      vehicleId,
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
