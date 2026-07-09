import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { ListQuotesUseCase } from "../../../../modules/application/use-cases/quote/list-quotes";
import { AuthenticatedUser } from "../../../auth/authenticated-user";
import { CurrentUser } from "../../../auth/current-user";
import { EmployeeFeatures } from "../../../auth/employee-features";
import { Roles } from "../../../auth/roles";
import { ListQuotesResponseDto } from "../../docs/domain-swagger.dto";
import { QuotePresenter } from "../../presenters/quote-presenter";
import { throwQuoteHttpError } from "./quote-http-errors";
import { QuoteZodValidationPipe } from "./quote-zod-validation.pipe";

const booleanQuerySchema = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

const listQuotesQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  customerId: z.uuid().optional(),
  customerName: z.string().trim().min(1).max(100).optional(),
  vehicleId: z.uuid().optional(),
  vehiclePlate: z.string().trim().min(1).max(100).optional(),
  serviceId: z.uuid().optional(),
  serviceName: z.string().trim().min(1).max(100).optional(),
  expiresFrom: z.coerce.date().optional(),
  expiresTo: z.coerce.date().optional(),
  converted: booleanQuerySchema.optional(),
  createdAt: z.coerce.date().optional(),
  sort: z.enum(["recent", "oldest"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  size: z.coerce.number().int().positive().optional(),
});

type ListQuotesQuerySchema = z.infer<typeof listQuotesQuerySchema>;

@ApiTags("quotes")
@ApiBearerAuth("access-token")
@Controller("/quotes")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["read:quotes"])
export class ListQuotesController {
  constructor(private readonly listQuotes: ListQuotesUseCase) {}

  @Get()
  @ApiOperation({
    summary: "List commercial quotes for the authenticated establishment.",
  })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "customerId", required: false, format: "uuid" })
  @ApiQuery({ name: "customerName", required: false, type: String })
  @ApiQuery({ name: "vehicleId", required: false, format: "uuid" })
  @ApiQuery({ name: "vehiclePlate", required: false, type: String })
  @ApiQuery({ name: "serviceId", required: false, format: "uuid" })
  @ApiQuery({ name: "serviceName", required: false, type: String })
  @ApiQuery({ name: "expiresFrom", required: false, type: String })
  @ApiQuery({ name: "expiresTo", required: false, type: String })
  @ApiQuery({ name: "converted", required: false, type: Boolean })
  @ApiQuery({ name: "createdAt", required: false, type: String })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: ["recent", "oldest"],
    description:
      "Sort quotes by creation date. Defaults to recent when omitted.",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "size", required: false, type: Number })
  @ApiOkResponse({
    description: "Quotes listed successfully.",
    type: ListQuotesResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid query parameters." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({
    description:
      "Authenticated user does not have the required role or employee feature.",
  })
  @ApiNotFoundResponse({ description: "Establishment profile was not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new QuoteZodValidationPipe(listQuotesQuerySchema))
    query: ListQuotesQuerySchema,
  ) {
    const filters = {
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.customerId !== undefined
        ? { customerId: query.customerId }
        : {}),
      ...(query.customerName !== undefined
        ? { customerName: query.customerName }
        : {}),
      ...(query.vehicleId !== undefined ? { vehicleId: query.vehicleId } : {}),
      ...(query.vehiclePlate !== undefined
        ? { vehiclePlate: query.vehiclePlate }
        : {}),
      ...(query.serviceId !== undefined ? { serviceId: query.serviceId } : {}),
      ...(query.serviceName !== undefined
        ? { serviceName: query.serviceName }
        : {}),
      ...(query.expiresFrom !== undefined
        ? { expiresFrom: query.expiresFrom }
        : {}),
      ...(query.expiresTo !== undefined ? { expiresTo: query.expiresTo } : {}),
      ...(query.converted !== undefined ? { converted: query.converted } : {}),
      ...(query.createdAt !== undefined ? { createdAt: query.createdAt } : {}),
      ...(query.sort !== undefined ? { sort: query.sort } : {}),
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.size !== undefined ? { size: query.size } : {}),
    };

    const referenceDate = new Date();

    const result = await this.listQuotes.execute({
      actor: { userId: user.userId, role: user.role },
      filters,
      referenceDate,
    });

    if (result.isLeft()) {
      throwQuoteHttpError(result.value);
    }

    return {
      quotes: result.value.quotes.map((quote) =>
        QuotePresenter.toListItem(quote, referenceDate),
      ),
      totalItems: result.value.totalItems,
      summary: result.value.summary,
    };
  }
}
