import { isoWeekday } from "@/lib/time";

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
