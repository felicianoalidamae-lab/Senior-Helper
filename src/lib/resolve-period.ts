import {
  currentMonthRange,
  currentPayPeriod,
  previousMonthRange,
  previousPayPeriod,
  type DateRange,
} from "@/lib/pay-period";
import { businessToday } from "@/lib/time";
import type { Settings } from "@/lib/supabase/types";

export function resolvePeriod(
  searchParams: { [key: string]: string | string[] | undefined },
  settings: Pick<Settings, "pay_period_anchor" | "pay_period_days" | "timezone">
): DateRange {
  const period = typeof searchParams.period === "string" ? searchParams.period : "current";
  const { pay_period_anchor, pay_period_days, timezone } = settings;

  switch (period) {
    case "previous":
      return previousPayPeriod(pay_period_anchor, pay_period_days, timezone);
    case "this_month":
      return currentMonthRange(timezone);
    case "last_month":
      return previousMonthRange(timezone);
    case "custom": {
      const from = typeof searchParams.from === "string" ? searchParams.from : undefined;
      const to = typeof searchParams.to === "string" ? searchParams.to : undefined;
      if (from && to) return { start: from, end: to };
      return currentPayPeriod(pay_period_anchor, pay_period_days, timezone);
    }
    case "current":
    default:
      return currentPayPeriod(pay_period_anchor, pay_period_days, timezone);
  }
}

export function isFuture(dateStr: string, timeZone: string): boolean {
  return dateStr > businessToday(timeZone);
}
