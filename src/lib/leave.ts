/** Converts a JS Date (UTC) day-of-week to the spec's 1=Mon…7=Sun convention. */
export function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/** Counts how many dates in [startDate, endDate] (inclusive, YYYY-MM-DD) fall on a configured work day. */
export function countWorkDays(startDate: string, endDate: string, workDays: number[]): number {
  let count = 0;
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    if (workDays.includes(isoWeekday(cursor))) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
