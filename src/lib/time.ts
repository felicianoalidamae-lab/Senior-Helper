/** Converts a JS Date (UTC) day-of-week to the spec's 1=Mon…7=Sun convention. */
export function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The calendar date (YYYY-MM-DD) `date` falls on in `timeZone`. */
export function zonedDateString(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

export function businessToday(timeZone: string): string {
  return zonedDateString(new Date(), timeZone);
}

/** The [start, end] (inclusive, YYYY-MM-DD) of the workweek containing `dateStr`. */
export function workweekRange(dateStr: string, weekStartDay: number): { start: string; end: string } {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dow = isoWeekday(d);
  const diff = (dow - weekStartDay + 7) % 7;
  const start = new Date(d);
  start.setUTCDate(start.getUTCDate() - diff);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: toDateStr(start), end: toDateStr(end) };
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}
