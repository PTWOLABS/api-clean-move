import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export type DashboardMetricPeriod =
  | "this-month"
  | "last-7-days"
  | "last-30-days";

export type DashboardMetricGranularity =
  | "auto"
  | "daily"
  | "weekly"
  | "monthly";

export type DashboardMetricDateRange = {
  startsAt: Date;
  endsAt: Date;
};

export type ResolvedDashboardMetricsRange = {
  current: DashboardMetricDateRange;
  comparison: DashboardMetricDateRange;
  period?: DashboardMetricPeriod;
  granularity?: DashboardMetricGranularity;
};

export type DashboardMetricsRangeQuery = {
  period?: DashboardMetricPeriod;
  startsAt?: Date;
  endsAt?: Date;
  granularity?: DashboardMetricGranularity;
};

export type ResolveDashboardMetricsRangeOptions = {
  referenceDate: Date;
};

export class InvalidDashboardMetricsRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDashboardMetricsRangeError";
  }
}

export function resolveDashboardMetricsRange(
  query: DashboardMetricsRangeQuery,
  { referenceDate }: ResolveDashboardMetricsRangeOptions,
): ResolvedDashboardMetricsRange {
  const referenceDayEnd = endOfUtcDay(referenceDate);
  const hasCustomRange =
    query.startsAt !== undefined || query.endsAt !== undefined;

  const current = hasCustomRange
    ? resolveCustomRange(query, referenceDayEnd)
    : resolvePresetRange(query.period ?? "this-month", referenceDate);

  assertRangeIsValid(current);
  assertStartsAtIsNotFuture(current.startsAt, referenceDate);
  assertRangeDoesNotExceedTwentyFourMonths(current);

  const period = hasCustomRange ? undefined : (query.period ?? "this-month");
  const comparison = period
    ? resolvePresetComparison(period, current)
    : resolveCustomComparison(current);

  return {
    current,
    comparison,
    ...(period !== undefined ? { period } : {}),
    ...(query.granularity !== undefined
      ? { granularity: query.granularity }
      : {}),
  };
}

function resolveCustomRange(
  query: DashboardMetricsRangeQuery,
  referenceDayEnd: Date,
): DashboardMetricDateRange {
  if (query.endsAt !== undefined && query.startsAt === undefined) {
    throw new InvalidDashboardMetricsRangeError("endsAt requires startsAt.");
  }

  if (query.startsAt === undefined) {
    throw new InvalidDashboardMetricsRangeError("startsAt is required.");
  }

  return {
    startsAt: copyDate(query.startsAt),
    endsAt:
      query.endsAt !== undefined ? copyDate(query.endsAt) : referenceDayEnd,
  };
}

function resolvePresetRange(
  period: DashboardMetricPeriod,
  referenceDate: Date,
): DashboardMetricDateRange {
  const referenceDayStart = dayjs.utc(referenceDate).startOf("day");
  const referenceDayEnd = endOfUtcDay(referenceDate);

  if (period === "last-7-days") {
    return {
      startsAt: toDate(referenceDayStart.subtract(6, "day")),
      endsAt: referenceDayEnd,
    };
  }

  if (period === "last-30-days") {
    return {
      startsAt: toDate(referenceDayStart.subtract(29, "day")),
      endsAt: referenceDayEnd,
    };
  }

  return {
    startsAt: startOfUtcMonth(referenceDate),
    endsAt: referenceDayEnd,
  };
}

function resolvePresetComparison(
  period: DashboardMetricPeriod,
  current: DashboardMetricDateRange,
): DashboardMetricDateRange {
  if (period === "last-7-days") {
    return previousCalendarDays(current, 7);
  }

  if (period === "last-30-days") {
    return previousCalendarDays(current, 30);
  }

  return {
    startsAt: toDate(dayjs.utc(current.startsAt).subtract(1, "month")),
    endsAt: toDate(dayjs.utc(current.endsAt).subtract(1, "month")),
  };
}

function resolveCustomComparison(
  current: DashboardMetricDateRange,
): DashboardMetricDateRange {
  if (isClosedFullUtcMonth(current)) {
    const previousMonthDate = dayjs.utc(current.startsAt).subtract(1, "month");

    return {
      startsAt: toDate(previousMonthDate.startOf("month")),
      endsAt: toDate(previousMonthDate.endOf("month")),
    };
  }

  const durationInMilliseconds =
    current.endsAt.getTime() - current.startsAt.getTime();

  return {
    startsAt: new Date(current.startsAt.getTime() - durationInMilliseconds - 1),
    endsAt: new Date(current.startsAt.getTime() - 1),
  };
}

function previousCalendarDays(
  current: DashboardMetricDateRange,
  days: number,
): DashboardMetricDateRange {
  const comparisonEndsAt = dayjs
    .utc(current.startsAt)
    .subtract(1, "day")
    .endOf("day");

  return {
    startsAt: toDate(comparisonEndsAt.subtract(days - 1, "day").startOf("day")),
    endsAt: toDate(comparisonEndsAt),
  };
}

function assertRangeIsValid(range: DashboardMetricDateRange) {
  if (range.endsAt.getTime() < range.startsAt.getTime()) {
    throw new InvalidDashboardMetricsRangeError(
      "endsAt must be greater than or equal to startsAt.",
    );
  }
}

function assertStartsAtIsNotFuture(startsAt: Date, referenceDate: Date) {
  if (startsAt.getTime() > referenceDate.getTime()) {
    throw new InvalidDashboardMetricsRangeError(
      "startsAt cannot be in the future.",
    );
  }
}

function assertRangeDoesNotExceedTwentyFourMonths(
  range: DashboardMetricDateRange,
) {
  const limit = dayjs.utc(range.startsAt).add(24, "month").endOf("day");

  if (range.endsAt.getTime() > limit.valueOf()) {
    throw new InvalidDashboardMetricsRangeError(
      "Range cannot exceed 24 calendar months.",
    );
  }
}

function isClosedFullUtcMonth(range: DashboardMetricDateRange) {
  return (
    range.startsAt.getTime() === startOfUtcMonth(range.startsAt).getTime() &&
    range.endsAt.getTime() === endOfUtcMonth(range.startsAt).getTime()
  );
}

function endOfUtcDay(date: Date) {
  return toDate(dayjs.utc(date).endOf("day"));
}

function startOfUtcMonth(date: Date) {
  return toDate(dayjs.utc(date).startOf("month"));
}

function endOfUtcMonth(date: Date) {
  return toDate(dayjs.utc(date).endOf("month"));
}

function copyDate(date: Date) {
  return new Date(date.getTime());
}

function toDate(value: dayjs.Dayjs) {
  return value.toDate();
}
