import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import {
  DashboardMetricDateRange,
  DashboardMetricGranularity,
  DashboardMetricPeriod,
  InvalidDashboardMetricsRangeError,
} from "./dashboard-metrics-range-resolver";

dayjs.extend(utc);

export type ResolvedDashboardMetricGranularity = Exclude<
  DashboardMetricGranularity,
  "auto"
>;

export type ResolveDashboardMetricGranularityInput = {
  requestedGranularity?: DashboardMetricGranularity;
  period?: DashboardMetricPeriod;
  range: DashboardMetricDateRange;
  referenceDate: Date;
};

export type DashboardMetricBucket = {
  date: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
};

export const DASHBOARD_OVERVIEW_MAX_POINTS = 7;

const PORTUGUESE_MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export function resolveDashboardMetricGranularity({
  requestedGranularity,
  period,
  range,
  referenceDate,
}: ResolveDashboardMetricGranularityInput): ResolvedDashboardMetricGranularity {
  if (requestedGranularity !== undefined && requestedGranularity !== "auto") {
    assertGranularityIsCompatibleWithRange(requestedGranularity, range);

    return requestedGranularity;
  }

  if (period === "last-7-days") {
    return "daily";
  }

  if (period === "last-30-days") {
    return "weekly";
  }

  if (period === "this-month") {
    return dayjs.utc(referenceDate).date() <= 15 ? "daily" : "weekly";
  }

  assertGranularityIsCompatibleWithRange("monthly", range);

  if (getCalendarDayCount(range) <= 31) {
    return "weekly";
  }

  return "monthly";
}

export function buildDashboardMetricBuckets(
  range: DashboardMetricDateRange,
  granularity: ResolvedDashboardMetricGranularity,
): DashboardMetricBucket[] {
  assertGranularityIsCompatibleWithRange(granularity, range);

  const buckets: DashboardMetricBucket[] = [];
  let bucketStart = getStableBucketStart(range.startsAt, granularity);

  while (bucketStart.valueOf() <= range.endsAt.getTime()) {
    const bucketEnd = getStableBucketEnd(bucketStart, granularity);

    if (bucketEnd.valueOf() >= range.startsAt.getTime()) {
      buckets.push({
        date: formatBucketDate(bucketStart, granularity),
        label: formatBucketLabel(bucketStart, granularity),
        startsAt: maxDate(bucketStart.toDate(), range.startsAt),
        endsAt: minDate(bucketEnd.toDate(), range.endsAt),
      });
    }

    bucketStart = getNextBucketStart(bucketStart, granularity);
  }

  return buckets;
}

export function resolveDashboardOverviewGranularity(
  range: DashboardMetricDateRange,
): ResolvedDashboardMetricGranularity {
  const calendarDayCount = getCalendarDayCount(range);

  if (calendarDayCount <= 7) {
    return "daily";
  }

  if (calendarDayCount <= 49) {
    return "weekly";
  }

  return "monthly";
}

export function buildDashboardOverviewBuckets(
  range: DashboardMetricDateRange,
  maxPoints = DASHBOARD_OVERVIEW_MAX_POINTS,
): DashboardMetricBucket[] {
  const buckets = buildDashboardMetricBuckets(
    range,
    resolveDashboardOverviewGranularity(range),
  );

  if (buckets.length <= maxPoints) {
    return buckets;
  }

  return compactDashboardMetricBuckets(buckets, maxPoints);
}

export function getDashboardMetricBucketKey(
  date: Date,
  buckets: DashboardMetricBucket[],
): string | null {
  const timestamp = date.getTime();
  const bucket = buckets.find(
    ({ startsAt, endsAt }) =>
      timestamp >= startsAt.getTime() && timestamp <= endsAt.getTime(),
  );

  return bucket?.date ?? null;
}

export function calculateTrendPercent(
  currentValue: number,
  previousValue: number,
): number | null {
  if (previousValue === 0) {
    return null;
  }

  return Math.round(((currentValue - previousValue) / previousValue) * 100);
}

export function calculatePercentPointDifference(
  currentPercent: number,
  previousPercent: number | null | undefined,
): number | null {
  if (previousPercent === null || previousPercent === undefined) {
    return null;
  }

  return Math.round((currentPercent - previousPercent) * 10) / 10;
}

function assertGranularityIsCompatibleWithRange(
  granularity: ResolvedDashboardMetricGranularity,
  range: DashboardMetricDateRange,
) {
  if (granularity === "daily" && getCalendarDayCount(range) > 31) {
    throw new InvalidDashboardMetricsRangeError(
      "Daily granularity supports ranges up to 31 days.",
    );
  }

  if (granularity === "weekly" && getCalendarDayCount(range) > 180) {
    throw new InvalidDashboardMetricsRangeError(
      "Weekly granularity supports ranges up to 180 days.",
    );
  }

  if (
    granularity === "monthly" &&
    range.endsAt.getTime() >
      dayjs.utc(range.startsAt).add(24, "month").endOf("day").valueOf()
  ) {
    throw new InvalidDashboardMetricsRangeError(
      "Monthly granularity supports ranges up to 24 calendar months.",
    );
  }
}

function getCalendarDayCount(range: DashboardMetricDateRange) {
  return (
    dayjs
      .utc(range.endsAt)
      .startOf("day")
      .diff(dayjs.utc(range.startsAt).startOf("day"), "day") + 1
  );
}

function getStableBucketStart(
  date: Date,
  granularity: ResolvedDashboardMetricGranularity,
) {
  const value = dayjs.utc(date);

  if (granularity === "daily") {
    return value.startOf("day");
  }

  if (granularity === "weekly") {
    return value.startOf("day").subtract(getDaysSinceMonday(value), "day");
  }

  return value.startOf("month");
}

function getStableBucketEnd(
  bucketStart: dayjs.Dayjs,
  granularity: ResolvedDashboardMetricGranularity,
) {
  if (granularity === "daily") {
    return bucketStart.endOf("day");
  }

  if (granularity === "weekly") {
    return bucketStart.add(6, "day").endOf("day");
  }

  return bucketStart.endOf("month");
}

function getNextBucketStart(
  bucketStart: dayjs.Dayjs,
  granularity: ResolvedDashboardMetricGranularity,
) {
  if (granularity === "daily") {
    return bucketStart.add(1, "day");
  }

  if (granularity === "weekly") {
    return bucketStart.add(1, "week");
  }

  return bucketStart.add(1, "month");
}

function getDaysSinceMonday(date: dayjs.Dayjs) {
  return (date.day() + 6) % 7;
}

function compactDashboardMetricBuckets(
  buckets: DashboardMetricBucket[],
  maxPoints: number,
) {
  const compactedBuckets: DashboardMetricBucket[] = [];
  const baseGroupSize = Math.floor(buckets.length / maxPoints);
  const remainder = buckets.length % maxPoints;
  let index = 0;

  for (let groupIndex = 0; groupIndex < maxPoints; groupIndex += 1) {
    const groupSize = baseGroupSize + (groupIndex < remainder ? 1 : 0);
    const bucketGroup = buckets.slice(index, index + groupSize);

    if (bucketGroup.length === 0) {
      continue;
    }

    compactedBuckets.push({
      date: bucketGroup[0]!.date,
      label: bucketGroup[0]!.label,
      startsAt: bucketGroup[0]!.startsAt,
      endsAt: bucketGroup[bucketGroup.length - 1]!.endsAt,
    });

    index += groupSize;
  }

  return compactedBuckets;
}

function formatBucketDate(
  bucketStart: dayjs.Dayjs,
  granularity: ResolvedDashboardMetricGranularity,
) {
  if (granularity === "monthly") {
    return bucketStart.format("YYYY-MM");
  }

  return bucketStart.format("YYYY-MM-DD");
}

function formatBucketLabel(
  bucketStart: dayjs.Dayjs,
  granularity: ResolvedDashboardMetricGranularity,
): string {
  if (granularity === "monthly") {
    return PORTUGUESE_MONTH_LABELS[bucketStart.month()]!;
  }

  return bucketStart.format("DD/MM");
}

function maxDate(first: Date, second: Date) {
  return first.getTime() >= second.getTime() ? first : second;
}

function minDate(first: Date, second: Date) {
  return first.getTime() <= second.getTime() ? first : second;
}
