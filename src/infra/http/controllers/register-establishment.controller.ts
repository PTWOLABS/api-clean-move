import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  InternalServerErrorException,
  Post,
  UsePipes,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import z from "zod";
import { Public } from "../../auth/public";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { RegisterEstablishmentUseCase } from "../../../modules/application/use-cases/establishment/register-establishment";
import { InvalidRegisterEstablishmentInputError } from "../../../modules/establishments/domain/errors/invalid-register-establishment-input-error";
import { ResourceAlreadyExistsError } from "../../../shared/errors/resource-already-exists-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import {
  RegisterEstablishmentBodyDto,
  RegisterEstablishmentResponseDto,
} from "../docs/domain-swagger.dto";

const registerEstablishmentBodySchema = z
  .object({
    name: z.string().trim().min(1),
    tradeName: z.string().trim().min(1),
    legalBusinessName: z.string().trim().min(1),
    email: z.email(),
    password: z.string().nonempty().max(72),
    cnpj: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    address: z
      .object({
        street: z.string().trim().min(1),
        complement: z.string().trim().optional().nullable(),
        country: z.string().trim().min(1),
        state: z.string().trim().min(1),
        zipCode: z.string().trim().min(1),
        city: z.string().trim().min(1),
      })
      .strict(),
    slug: z.string().trim().min(1).optional(),
  })
  .strict();

type RegisterEstablishmentBodySchema = z.infer<
  typeof registerEstablishmentBodySchema
>;

@ApiTags("register")
@Controller("/register/establishment")
@Public()
export class RegisterEstablishmentController {
  constructor(private registerEstablishment: RegisterEstablishmentUseCase) {}

  @Post()
  @UsePipes(new ZodValidationPipe(registerEstablishmentBodySchema))
  @ApiOperation({ summary: "Register a new establishment account." })
  @ApiBody({ type: RegisterEstablishmentBodyDto })
  @ApiCreatedResponse({
    description: "Establishment created successfully.",
    type: RegisterEstablishmentResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid establishment registration payload.",
  })
  @ApiConflictResponse({
    description:
      "An establishment with the provided unique data already exists.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while creating the establishment.",
  })
  async handle(@Body() body: RegisterEstablishmentBodySchema) {
    const result = await this.registerEstablishment.execute(body);

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceAlreadyExistsError:
          throw new ConflictException(error.message);
        case InvalidRegisterEstablishmentInputError:
          throw new BadRequestException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new BadRequestException(error.message);
      }
    }

    return {
      establishmentId: result.value.establishment.id.toString(),
    };
  }
}
