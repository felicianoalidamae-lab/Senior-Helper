import { isoWeekday } from "@/lib/time";
import type { LeaveRequest, LeaveType } from "@/lib/supabase/types";

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

export const LEAVE_STATUS_CHIP_CLASS: Record<string, string> = {
  pending: "bg-amber-50 text-status-break",
  approved: "bg-green-50 text-status-working",
  declined: "bg-red-50 text-status-declined",
  cancelled: "bg-gray-100 text-status-off",
};

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  sick: "Sick",
  emergency: "Emergency",
  vacation: "Vacation",
};

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Approved leave days taken this year, by type, counting only configured work days. */
export function summarizeApprovedLeave(
  requests: Pick<LeaveRequest, "type" | "start_date" | "end_date" | "status">[],
  workDays: number[],
  year: number = new Date().getUTCFullYear()
): Record<LeaveType, number> {
  const totals: Record<LeaveType, number> = { sick: 0, emergency: 0, vacation: 0 };
  for (const r of requests) {
    if (r.status !== "approved") continue;
    if (new Date(r.start_date).getUTCFullYear() !== year) continue;
    totals[r.type] += countWorkDays(r.start_date, r.end_date, workDays);
  }
  return totals;
}
