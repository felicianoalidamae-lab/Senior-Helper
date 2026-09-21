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

/** `timeZone`'s UTC offset (ms, positive east of UTC) at the given instant. */
function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - instant.getTime();
}

/**
 * Converts a wall-clock date + time (as read on a clock in `timeZone`) to
 * the UTC instant it represents. Used for the owner's manual time-entry
 * form, where dates/times are entered in the business time zone.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const localAsIfUTC = Date.parse(`${dateStr}T${timeStr}:00.000Z`);
  let guess = localAsIfUTC;
  for (let i = 0; i < 2; i++) {
    const offset = getTimeZoneOffsetMs(new Date(guess), timeZone);
    guess = localAsIfUTC - offset;
  }
  return new Date(guess);
}
