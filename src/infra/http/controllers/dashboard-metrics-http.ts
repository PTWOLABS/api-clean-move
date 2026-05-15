import {
  applyDecorators,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";

import { EstablishmentMetricsFilters } from "../../../modules/application/use-cases/establishment/establishment-metrics-helpers";
import { Either } from "../../../shared/either";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";

export const SERVICE_CATEGORIES = [
  "WASH",
  "SANITIZATION",
  "AUTOMATIVE_DETAILING",
  "PROTECTION",
  "UPHOLSTERY",
] as const;

export const APPOINTMENT_STATUSES = ["SCHEDULED", "DONE", "CANCELLED"] as const;

export const DASHBOARD_METRIC_PERIODS = [
  "this-month",
  "last-7-days",
  "last-30-days",
] as const;

export const DASHBOARD_METRIC_GRANULARITIES = [
  "auto",
  "daily",
  "weekly",
  "monthly",
] as const;

const serviceCategorySchema = z.enum(SERVICE_CATEGORIES);
const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);
const dashboardMetricPeriodSchema = z.enum(DASHBOARD_METRIC_PERIODS);
const dashboardMetricGranularitySchema = z.enum(DASHBOARD_METRIC_GRANULARITIES);

const dateTimeQuerySchema = z.iso
  .datetime({ offset: true })
  .refine(
    (value) => {
      const dateParts = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value);

      if (!dateParts) {
        return false;
      }

      const [, yearValue, monthValue, dayValue] = dateParts;
      const year = Number(yearValue);
      const month = Number(monthValue);
      const day = Number(dayValue);
      const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

      return day >= 1 && day <= lastDayOfMonth;
    },
    {
      message: "Invalid calendar date.",
    },
  )
  .transform((value) => new Date(value));

function toOptionalArray(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];
  const normalizedValues = values
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return normalizedValues.length > 0 ? normalizedValues : undefined;
}

function validateMetricsDateRange(
  query: { startsAt?: Date | undefined; endsAt?: Date | undefined },
  context: z.RefinementCtx,
) {
  if (query.endsAt && !query.startsAt) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "endsAt requires startsAt.",
    });
  }

  if (
    query.startsAt &&
    query.endsAt &&
    query.startsAt.getTime() > query.endsAt.getTime()
  ) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "endsAt must be greater than or equal to startsAt.",
    });
  }
}

export const dashboardMetricsQuerySchema = z
  .object({
    startsAt: dateTimeQuerySchema.optional(),
    endsAt: dateTimeQuerySchema.optional(),
    categories: z.preprocess(
      toOptionalArray,
      z.array(serviceCategorySchema).optional(),
    ),
    status: z.preprocess(
      toOptionalArray,
      z.array(appointmentStatusSchema).optional(),
    ),
  })
  .superRefine((query, context) => {
    if (
      query.startsAt &&
      query.endsAt &&
      query.startsAt.getTime() > query.endsAt.getTime()
    ) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "endsAt must be greater than or equal to startsAt.",
      });
    }
  });

const dashboardDynamicMetricsQueryBaseSchema = z.object({
  period: dashboardMetricPeriodSchema.optional(),
  startsAt: dateTimeQuerySchema.optional(),
  endsAt: dateTimeQuerySchema.optional(),
  granularity: dashboardMetricGranularitySchema.optional(),
  categories: z.preprocess(
    toOptionalArray,
    z.array(serviceCategorySchema).optional(),
  ),
  status: z.preprocess(
    toOptionalArray,
    z.array(appointmentStatusSchema).optional(),
  ),
});

export const dashboardDynamicMetricsQuerySchema =
  dashboardDynamicMetricsQueryBaseSchema.superRefine(validateMetricsDateRange);

export const dashboardPopularServicesMetricsQuerySchema =
  dashboardDynamicMetricsQueryBaseSchema
    .extend({
      page: z.coerce.number().int().positive().default(1),
      size: z.coerce.number().int().positive().default(5),
    })
    .superRefine(validateMetricsDateRange);

export type DashboardMetricsQuerySchema = z.infer<
  typeof dashboardMetricsQuerySchema
>;

export type DashboardDynamicMetricsQuerySchema = z.infer<
  typeof dashboardDynamicMetricsQuerySchema
>;

export type DashboardPopularServicesMetricsQuerySchema = z.infer<
  typeof dashboardPopularServicesMetricsQuerySchema
>;

type DashboardMetricsResult<T> = Either<ResourceNotFoundError, T>;

export function buildMetricsFilters(
  query: DashboardMetricsQuerySchema,
): EstablishmentMetricsFilters {
  return {
    ...(query.startsAt !== undefined ? { startsAt: query.startsAt } : {}),
    ...(query.endsAt !== undefined ? { endsAt: query.endsAt } : {}),
    ...(query.categories !== undefined ? { categories: query.categories } : {}),
    ...(query.status !== undefined ? { status: query.status } : {}),
  };
}

export function ApiDashboardMetricsFilterQueries() {
  return applyDecorators(
    ApiQuery({
      name: "startsAt",
      required: false,
      type: String,
      format: "date-time",
      description:
        "Filter appointments starting at or after this ISO 8601 date-time.",
      example: "2026-04-01T00:00:00.000Z",
    }),
    ApiQuery({
      name: "endsAt",
      required: false,
      type: String,
      format: "date-time",
      description:
        "Filter appointments starting at or before this ISO 8601 date-time.",
      example: "2026-04-30T23:59:59.999Z",
    }),
    ApiQuery({
      name: "categories",
      required: false,
      enum: SERVICE_CATEGORIES,
      isArray: true,
      description:
        "Filter by booked service category snapshot. Repeat the query param or send comma-separated values.",
      example: ["WASH", "AUTOMATIVE_DETAILING"],
    }),
    ApiQuery({
      name: "status",
      required: false,
      enum: APPOINTMENT_STATUSES,
      isArray: true,
      description:
        "Filter by appointment status. Repeat the query param or send comma-separated values.",
      example: ["SCHEDULED", "CANCELLED"],
    }),
  );
}

export function ApiDashboardMetricsErrors() {
  return applyDecorators(
    ApiBadRequestResponse({
      description: "Invalid query parameters.",
    }),
    ApiUnauthorizedResponse({
      description: "Missing or invalid access token.",
    }),
    ApiForbiddenResponse({
      description: "Authenticated user does not have the establishment role.",
    }),
    ApiNotFoundResponse({
      description:
        "The authenticated establishment user does not have an establishment profile.",
    }),
    ApiInternalServerErrorResponse({
      description: "Unexpected failure while reading dashboard metrics.",
    }),
  );
}

export function unwrapDashboardMetricsResult<T>(
  result: DashboardMetricsResult<T>,
): T {
  if (result.isRight()) {
    return result.value;
  }

  const error = result.value;

  switch (error.constructor) {
    case ResourceNotFoundError:
      throw new NotFoundException(error.message);
    default:
      throw new InternalServerErrorException(error.message);
  }
}
