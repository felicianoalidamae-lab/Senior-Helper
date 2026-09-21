import { addDays, businessToday, toDateStr } from "@/lib/time";

export interface DateRange {
  start: string;
  end: string;
}

/** The pay period (start/end, inclusive, YYYY-MM-DD) containing `dateStr`, derived from the anchor. */
export function payPeriodContaining(dateStr: string, anchor: string, days: number): DateRange {
  const anchorDate = new Date(`${anchor}T00:00:00Z`);
  const target = new Date(`${dateStr}T00:00:00Z`);
  const diffDays = Math.floor((target.getTime() - anchorDate.getTime()) / 86400000);
  const periodIndex = Math.floor(diffDays / days);
  const start = new Date(anchorDate);
  start.setUTCDate(start.getUTCDate() + periodIndex * days);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + days - 1);
  return { start: toDateStr(start), end: toDateStr(end) };
}

export function currentPayPeriod(anchor: string, days: number, timeZone: string): DateRange {
  return payPeriodContaining(businessToday(timeZone), anchor, days);
}

export function previousPayPeriod(anchor: string, days: number, timeZone: string): DateRange {
  const current = currentPayPeriod(anchor, days, timeZone);
  return payPeriodContaining(addDays(current.start, -1), anchor, days);
}

export function currentMonthRange(timeZone: string): DateRange {
  const today = businessToday(timeZone);
  const parts = today.split("-");
  const y = parts[0] ?? "1970";
  const m = parts[1] ?? "01";
  const start = `${y}-${m}-01`;
  const lastDay = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  const end = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function previousMonthRange(timeZone: string): DateRange {
  const today = businessToday(timeZone);
  const parts = today.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const prevMonthDate = new Date(Date.UTC(y, m - 2, 1));
  const py = prevMonthDate.getUTCFullYear();
  const pm = prevMonthDate.getUTCMonth() + 1;
  const start = `${py}-${String(pm).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const end = `${py}-${String(pm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}
