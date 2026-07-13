import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export const QUOTE_EXPIRATION_TIMEZONE = "America/Sao_Paulo";

export function getSaoPauloDayBounds(referenceDate: Date) {
  const todayStart = dayjs(referenceDate)
    .tz(QUOTE_EXPIRATION_TIMEZONE)
    .startOf("day");
  const tomorrowStart = todayStart.add(1, "day");

  return {
    todayStart: todayStart.toDate(),
    tomorrowStart: tomorrowStart.toDate(),
  };
}
