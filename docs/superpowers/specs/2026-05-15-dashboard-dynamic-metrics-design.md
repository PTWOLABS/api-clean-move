# Dashboard Dynamic Metrics Design

## Goal

Refactor the dashboard metric endpoints so the backend returns data in a shape that the frontend can render directly in charts and user-facing metric cards.

This design keeps the existing dashboard metric route family and updates the contracts for the chart-focused endpoints. `dashboard-metrics-overview.controller.ts` is explicitly out of scope for this change.

## Endpoints In Scope

- `GET /dashboard/metrics/revenue`
- `GET /dashboard/metrics/appointments`
- `GET /dashboard/metrics/popular-services`

The implementation should refactor these existing endpoints instead of creating new versioned or aggregate endpoints.

## Query Contract

All endpoints in scope should accept the shared dashboard metric query contract:

```ts
type DashboardMetricsQuery = {
  period?: "this-month" | "last-7-days" | "last-30-days";
  startsAt?: string;
  endsAt?: string;
  granularity?: "auto" | "daily" | "weekly" | "monthly";
  categories?: ServiceCategory[];
  status?: AppointmentStatus[];
};
```

`startsAt` and `endsAt` are ISO 8601 date-time strings with offsets, matching the validation style already used by `dashboard-metrics-http.ts`.

`GET /dashboard/metrics/popular-services` also accepts optional pagination query params:

```ts
type PopularServicesPaginationQuery = {
  page?: number;
  size?: number;
};
```

Pagination defaults for popular services are `page=1` and `size=5`.

### Range Resolution

Range precedence:

1. If `startsAt` and `endsAt` are both provided, they define the current period.
2. If only `startsAt` is provided, the current period starts at `startsAt` and ends at the current day.
3. If only `endsAt` is provided, the request is invalid and should return `400`.
4. If no custom range is provided, `period` defines the current period.
5. If neither range nor `period` is provided, default to `period=this-month`.

Range validation:

- `startsAt` cannot be in the future.
- `endsAt` must be greater than or equal to `startsAt`.
- The maximum supported range is 24 months.
- Ranges above 24 months return `400`.

Period presets:

- `last-7-days`: the current period covers the last 7 calendar days.
- `last-30-days`: the current period covers the last 30 calendar days.
- `this-month`: the current period starts on the first day of the current month and ends on the current day.

For `startsAt` without `endsAt`, the endpoint should include appointments from `startsAt` through the current day. The implementation may normalize the resolved end to the end of the current day so the full day is included.

## Status Rules

When `status` is not provided:

- Revenue metrics use only `DONE` appointments.
- Appointment counts in the revenue chart use only `DONE` appointments.
- Popular services use only `DONE` appointments.
- Cancellation rate calculates its own cancellation base for the period, using cancelled appointments divided by total appointments in the comparison scope.

When `status` is provided explicitly, the filtered status list applies to the revenue chart and popular service queries. Cancellation rate ignores explicit `status` filters and always uses the full appointment status base for the selected period, because filtering out `CANCELLED` or non-cancelled appointments would make the rate misleading.

## Granularity

Supported granularities:

- `auto`
- `daily`
- `weekly`
- `monthly`

Explicit granularity validation:

- `daily`: allowed up to 31 days.
- `weekly`: allowed up to 180 days.
- `monthly`: allowed up to 24 months.

If the frontend requests a granularity that is incompatible with the resolved range, the API should return `400`. The backend should not silently downgrade or upgrade explicit granularities.

Automatic granularity for presets:

- `last-7-days`: `daily`
- `last-30-days`: `weekly`
- `this-month`: `daily` through day 15 of the month, then `weekly` from day 16 onward.

Automatic granularity for custom ranges:

- Up to 31 days: `weekly`
- Up to 180 days: `monthly`
- Up to 24 months: `monthly`

Weekly buckets should start on Monday. Monthly labels should use month names in Portuguese abbreviations, such as `Jan`, `Fev`, and `Mar`.

## Comparison Periods And Trends

Trend calculations compare the current period with the immediately previous equivalent period.

Rules:

- `last-7-days`: compare with the 7 calendar days immediately before the current period.
- `last-30-days`: compare with the 30 calendar days immediately before the current period.
- `this-month`: compare with the equivalent elapsed interval in the previous month.
- Closed full-month ranges: compare with the full previous month.
- Custom ranges: compare with the immediately previous range of the same duration.

Trend percentage formula:

```ts
trendPercent = ((currentValue - previousValue) / previousValue) * 100;
```

Return `null` when `previousValue` is `0` or the comparison period does not have enough data to produce a meaningful percentage.

Trend percentages should be rounded to the nearest integer because the frontend mock displays values such as `21` and `18`.

## Revenue And Appointments Endpoint

`GET /dashboard/metrics/revenue` becomes the main chart endpoint for revenue and completed appointments over time.

Response:

```ts
type RevenueAppointmentsPoint = {
  date: string;
  label: string;
  revenueInCents: number;
  appointments: number;
};

type RevenueAppointmentsSummary = {
  revenueInCents: number;
  appointments: number;
  revenueTrendPercent: number | null;
  appointmentsTrendPercent: number | null;
};

type RevenueAppointmentsResponse = {
  points: RevenueAppointmentsPoint[];
  summary: RevenueAppointmentsSummary;
};
```

Point rules:

- `date` is a stable bucket identifier.
- `label` is formatted for chart display.
- `revenueInCents` is the sum of net appointment revenue in the bucket.
- `appointments` is the completed appointment count in the bucket.

Label formats:

- `daily`: `dd/MM`, for example `20/05`.
- `weekly`: the week start date as `dd/MM`, for example `01/01`.
- `monthly`: Portuguese month abbreviation, for example `Jan`, `Fev`, `Mar`.

Buckets should include periods with no matching appointments so the chart can render a coherent time axis. Empty buckets return `revenueInCents: 0` and `appointments: 0`.

## Cancellation Rate Endpoint

`GET /dashboard/metrics/appointments` becomes the cancellation metric endpoint for the UI.

Response:

```ts
type AppointmentsData = {
  appointmentsCount: number;
  cancellationRate: {
    currentPercent: number;
    comparisonPercentPoints: number | null;
  };
};
```

Rules:

- `currentPercent` is the cancellation rate for the current period as a percentage, not a decimal fraction.
- `comparisonPercentPoints` is the current cancellation percentage minus the previous equivalent period cancellation percentage.
- `currentPercent` and `comparisonPercentPoints` should be rounded to one decimal place.
- Do not return `targetPercent` in this iteration.
- Return `null` for `comparisonPercentPoints` when the previous period has no meaningful comparison base.

Example:

```ts
{
  appointmentsCount: 256,
  cancellationRate: {
    currentPercent: 4.2,
    comparisonPercentPoints: -1.6
  }
}
```

## Popular Services Endpoint

`GET /dashboard/metrics/popular-services` returns completed services for the selected period.

The endpoint accepts pagination through optional query params:

```txt
?page=1&size=5
```

Pagination rules:

- `page` defaults to `1`.
- `size` defaults to `5`.
- `page` and `size` must be positive integers.
- Pagination is applied after grouping and sorting services by popularity.

Response:

```ts
type PopularService = {
  id: string;
  name: string;
  completedCount: number;
  percent: number;
};

type PopularServicesResponse = {
  popularServices: PopularService[];
  totalServices: number;
};
```

Rules:

- Use only `DONE` appointments by default.
- Group by the booked service snapshot stored on the appointment, preserving the current behavior.
- Sort by `completedCount` descending.
- `popularServices` contains the requested page of grouped service rows.
- `totalServices` is the sum of completed service appointments in the full selected period before pagination.
- `percent` is the service share over `totalServices`, not only over the current page.
- `percent` should be rounded to the nearest integer because the frontend mock displays whole percentages.
- If there are no completed services, return `popularServices: []` and `totalServices: 0`.

## Architecture

The implementation should reuse existing controllers, use cases, repositories, and presenters where practical:

- Expand `dashboard-metrics-http.ts` to validate the new query contract and resolve ranges.
- Add shared metrics helpers for range resolution, comparison period resolution, granularity validation, bucket generation, label formatting, and trend calculation.
- Update `GetEstablishmentRevenueVsAppointmentsUseCase` so it can return grouped buckets plus summary totals and trend values.
- Update `GetEstablishmentCancellationRateUseCase` so it returns current percent and previous-period comparison in percentage points.
- Update `GetEstablishmentPopularServicesByCategoryUseCase` so it returns the frontend-oriented popular service shape.
- Update `DashboardMetricsPresenter` and Swagger DTOs to match the new response contracts.
- Keep the repository abstraction unchanged unless a performance bottleneck requires adding aggregate repository methods.

The current helper `findAllAppointmentsByEstablishment` loads paginated appointment data and aggregates in memory. That is acceptable for this iteration because the API will enforce a 24-month range cap and coarse granularities for larger periods. A future optimization can move aggregation into Prisma queries if dashboard data volume grows.

## Error Handling

Return `400` for invalid query combinations:

- `endsAt` without `startsAt`.
- `startsAt` in the future.
- `endsAt` earlier than `startsAt`.
- Range above 24 months.
- Explicit granularity incompatible with the resolved range.
- Invalid `period`, `granularity`, `categories`, or `status` values.
- Invalid popular services `page` or `size` values.

Existing auth and ownership behavior remains unchanged:

- `401` for missing or invalid access token.
- `403` for non-establishment users.
- `404` when the authenticated establishment user has no establishment profile.

## Testing

Update unit and e2e coverage for:

- `period=this-month`, `last-7-days`, and `last-30-days`.
- Custom `startsAt` and `endsAt`.
- `startsAt` without `endsAt`.
- Rejection of `endsAt` without `startsAt`.
- Rejection of future `startsAt`.
- Rejection of ranges above 24 months.
- Rejection of incompatible explicit granularities.
- Daily, weekly, and monthly bucket output.
- Empty buckets inside a selected range.
- Revenue and appointments summary totals.
- Revenue and appointments trend percentages.
- `null` trends when previous values are zero or not meaningful.
- Cancellation current percent and comparison percentage points.
- Popular services totals and percentages.
- Popular services pagination defaults and explicit `page`/`size`.

Existing e2e tests for authentication, authorization, not found, and invalid date ordering should be preserved and updated to the new response shapes.

## Out Of Scope

- Changes to `dashboard-metrics-overview.controller.ts`.
- New endpoint versioning.
- A single aggregate endpoint that returns every dashboard widget.
- Yearly granularity.
- Persisted establishment-specific cancellation targets.
- Database-level aggregation optimizations.
