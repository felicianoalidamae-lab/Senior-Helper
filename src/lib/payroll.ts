/**
 * Pure payroll/overtime calculation (spec §7.4). No I/O, no Date.now(),
 * no reliance on anything but its inputs, so it can be unit tested
 * deterministically and reused by the on-screen report, CSV export, and
 * PDF export without duplicating the math.
 *
 * Money is always integer cents. Minutes are always whole minutes.
 */

import { isoWeekday, workweekRange, zonedDateString } from "@/lib/time";

export type LeaveType = "sick" | "emergency" | "vacation";
export type LeaveStatus = "pending" | "approved" | "declined" | "cancelled";

export interface RawTimeEntry {
  id: string;
  employeeId: string;
  clockIn: string; // ISO instant
  clockOut: string | null; // ISO instant; null = still open (excluded from pay)
  breaks: { start: string; end: string | null }[];
  source: "live" | "manual";
}

export interface RawLeaveRequest {
  employeeId: string;
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: LeaveStatus;
}

export interface RateSchedule {
  employeeId: string;
  hourlyRateCents: number;
  effectiveFrom: string; // YYYY-MM-DD
}

export interface PayrollSettings {
  timezone: string;
  breaksUnpaid: boolean;
  shiftTargetMinutes: number;
  workDays: number[]; // 1=Mon…7=Sun
  paidLeaveTypes: LeaveType[];
  weekStartDay: number; // 1=Mon…7=Sun
  weeklyOtThresholdMinutes: number;
  dailyOtThresholdMinutes: number | null;
  overtimeMultiplierPct: number; // 100 = 1.0x
}

export interface DayDetailRow {
  employeeId: string;
  date: string; // YYYY-MM-DD
  kind: "worked" | "leave";
  leaveType?: LeaveType;
  clockIn?: string;
  clockOut?: string;
  breakMinutes?: number;
  regularMinutes: number;
  overtimeMinutes: number;
  leaveMinutes: number;
  rateCents: number;
  regularCents: number;
  overtimeCents: number;
  leaveCents: number;
  totalCents: number;
  incomplete: boolean;
  edited: boolean;
}

export interface EmployeeFlags {
  incomplete: boolean;
  overtimeIncluded: boolean;
  edited: boolean;
  rateChanged: boolean;
  workedAndLeaveSameDay: boolean;
}

export interface EmployeeSummary {
  employeeId: string;
  daysWorked: number;
  regularMinutes: number;
  overtimeMinutes: number;
  leaveMinutes: number;
  totalMinutes: number;
  regularCents: number;
  overtimeCents: number;
  leaveCents: number;
  totalCents: number;
  flags: EmployeeFlags;
}

export interface PayrollResult {
  details: DayDetailRow[];
  summaries: EmployeeSummary[];
}

export interface CalculatePayrollInput {
  /**
   * Time entries for the report period AND enough surrounding days to
   * cover every workweek the period's days belong to (a workweek that
   * straddles the period boundary needs its out-of-period days too, so
   * the weekly overtime threshold is computed correctly — see rule 7).
   * The caller (the data-fetching layer) is responsible for widening the
   * query; this function only filters OUTPUT rows to [periodStart, periodEnd].
   */
  entries: RawTimeEntry[];
  leaveRequests: RawLeaveRequest[];
  rates: RateSchedule[];
  settings: PayrollSettings;
  periodStart: string;
  periodEnd: string;
}

function roundHalfUpCents(x: number): number {
  return Math.floor(x + 0.5);
}

function minutesBetween(aIso: string, bIso: string): number {
  return Math.floor((new Date(bIso).getTime() - new Date(aIso).getTime()) / 60000);
}

export function rateForDate(rates: RateSchedule[], employeeId: string, date: string): number {
  let best: RateSchedule | null = null;
  for (const r of rates) {
    if (r.employeeId !== employeeId) continue;
    if (r.effectiveFrom > date) continue;
    if (!best || r.effectiveFrom > best.effectiveFrom) best = r;
  }
  return best?.hourlyRateCents ?? 0;
}

interface DayWorked {
  minutes: number;
  incomplete: boolean;
  edited: boolean;
  clockIn?: string;
  clockOut?: string;
  breakMinutes: number;
}

export function calculatePayroll(input: CalculatePayrollInput): PayrollResult {
  const { entries, leaveRequests, rates, settings, periodStart, periodEnd } = input;

  // --- 1/2/3: bucket each entry into a business-timezone work date, sum
  // worked minutes per employee/day, and flag incomplete (open) entries. ---
  const workedByEmployeeDay = new Map<string, Map<string, DayWorked>>();

  for (const entry of entries) {
    const workDate = zonedDateString(new Date(entry.clockIn), settings.timezone);
    let byDate = workedByEmployeeDay.get(entry.employeeId);
    if (!byDate) {
      byDate = new Map();
      workedByEmployeeDay.set(entry.employeeId, byDate);
    }
    const existing = byDate.get(workDate) ?? { minutes: 0, incomplete: false, edited: false, breakMinutes: 0 };

    if (!entry.clockOut) {
      existing.incomplete = true;
    } else {
      const totalMin = minutesBetween(entry.clockIn, entry.clockOut);
      const breakMin = entry.breaks.reduce((sum, b) => (b.end ? sum + minutesBetween(b.start, b.end) : sum), 0);
      const workedMin = settings.breaksUnpaid ? totalMin - breakMin : totalMin;
      existing.minutes += workedMin;
      existing.breakMinutes += breakMin;
      existing.clockIn = existing.clockIn ?? entry.clockIn;
      existing.clockOut = entry.clockOut;
    }
    if (entry.source === "manual") existing.edited = true;

    byDate.set(workDate, existing);
  }

  // --- 5/6/7: overtime split per employee, per full workweek, in date order. ---
  const details: DayDetailRow[] = [];
  const employeeIds = new Set<string>([
    ...workedByEmployeeDay.keys(),
    ...leaveRequests.map((l) => l.employeeId),
  ]);

  for (const employeeId of employeeIds) {
    const byDate = workedByEmployeeDay.get(employeeId) ?? new Map<string, DayWorked>();

    // Group this employee's worked dates into workweeks.
    const weeks = new Map<string, string[]>(); // weekStart -> sorted dates
    for (const date of byDate.keys()) {
      const { start } = workweekRange(date, settings.weekStartDay);
      const list = weeks.get(start) ?? [];
      list.push(date);
      weeks.set(start, list);
    }

    for (const dates of weeks.values()) {
      dates.sort();
      let runningRegularMinutes = 0;

      for (const date of dates) {
        const day = byDate.get(date);
        if (!day) continue;
        const workedMin = day.minutes;

        const dailyOt =
          settings.dailyOtThresholdMinutes != null
            ? Math.max(0, workedMin - settings.dailyOtThresholdMinutes)
            : 0;
        const regularAfterDaily = workedMin - dailyOt;
        const newRunningTotal = runningRegularMinutes + regularAfterDaily;
        const weeklyOt = Math.max(
          0,
          Math.min(regularAfterDaily, newRunningTotal - settings.weeklyOtThresholdMinutes)
        );
        runningRegularMinutes = newRunningTotal - weeklyOt;

        const overtimeMin = dailyOt + weeklyOt;
        const regularMin = workedMin - overtimeMin;

        if (date < periodStart || date > periodEnd) continue;

        const rateCents = rateForDate(rates, employeeId, date);
        const totalCents = roundHalfUpCents(
          (regularMin * rateCents * 100 + overtimeMin * rateCents * settings.overtimeMultiplierPct) / 6000
        );
        const regularCents = roundHalfUpCents((regularMin * rateCents) / 60);
        const overtimeCents = totalCents - regularCents;

        details.push({
          employeeId,
          date,
          kind: "worked",
          clockIn: day.clockIn,
          clockOut: day.clockOut,
          breakMinutes: day.breakMinutes,
          regularMinutes: regularMin,
          overtimeMinutes: overtimeMin,
          leaveMinutes: 0,
          rateCents,
          regularCents,
          overtimeCents,
          leaveCents: 0,
          totalCents,
          incomplete: day.incomplete,
          edited: day.edited,
        });
      }
    }

    // Days with ONLY an incomplete (open) entry and zero worked minutes
    // still need to be visible/flagged even though they contribute no pay.
    for (const [date, day] of byDate) {
      if (date < periodStart || date > periodEnd) continue;
      if (day.minutes === 0 && day.incomplete) {
        const alreadyAdded = details.some((d) => d.employeeId === employeeId && d.date === date && d.kind === "worked");
        if (!alreadyAdded) {
          details.push({
            employeeId,
            date,
            kind: "worked",
            clockIn: day.clockIn,
            clockOut: day.clockOut,
            breakMinutes: day.breakMinutes,
            regularMinutes: 0,
            overtimeMinutes: 0,
            leaveMinutes: 0,
            rateCents: rateForDate(rates, employeeId, date),
            regularCents: 0,
            overtimeCents: 0,
            leaveCents: 0,
            totalCents: 0,
            incomplete: true,
            edited: day.edited,
          });
        }
      }
    }
  }

  // --- 10: paid leave days (straight time, never overtime, doesn't touch the threshold). ---
  for (const leave of leaveRequests) {
    if (leave.status !== "approved") continue;
    if (!settings.paidLeaveTypes.includes(leave.type)) continue;

    let cursor = leave.startDate;
    while (cursor <= leave.endDate) {
      if (cursor >= periodStart && cursor <= periodEnd && settings.workDays.includes(isoWeekday(new Date(`${cursor}T00:00:00Z`)))) {
        const rateCents = rateForDate(rates, leave.employeeId, cursor);
        const leaveCents = roundHalfUpCents((settings.shiftTargetMinutes * rateCents) / 60);
        details.push({
          employeeId: leave.employeeId,
          date: cursor,
          kind: "leave",
          leaveType: leave.type,
          regularMinutes: 0,
          overtimeMinutes: 0,
          leaveMinutes: settings.shiftTargetMinutes,
          rateCents,
          regularCents: 0,
          overtimeCents: 0,
          leaveCents,
          totalCents: leaveCents,
          incomplete: false,
          edited: false,
        });
      }
      cursor = nextDay(cursor);
    }
  }

  details.sort((a, b) => (a.employeeId === b.employeeId ? a.date.localeCompare(b.date) : a.employeeId.localeCompare(b.employeeId)));

  // --- Summaries + flags (§7.2). ---
  const summaries: EmployeeSummary[] = [];
  for (const employeeId of employeeIds) {
    const rows = details.filter((d) => d.employeeId === employeeId);
    if (rows.length === 0) continue;

    const workedDates = new Set(rows.filter((r) => r.kind === "worked" && (r.regularMinutes > 0 || r.overtimeMinutes > 0)).map((r) => r.date));
    const leaveDates = new Set(rows.filter((r) => r.kind === "leave").map((r) => r.date));
    const workedAndLeaveSameDay = [...workedDates].some((d) => leaveDates.has(d));

    const periodRates = new Set(
      rates
        .filter((r) => r.employeeId === employeeId && r.effectiveFrom >= periodStart && r.effectiveFrom <= periodEnd)
        .map((r) => r.effectiveFrom)
    );

    const summary: EmployeeSummary = {
      employeeId,
      daysWorked: workedDates.size,
      regularMinutes: sum(rows, (r) => r.regularMinutes),
      overtimeMinutes: sum(rows, (r) => r.overtimeMinutes),
      leaveMinutes: sum(rows, (r) => r.leaveMinutes),
      totalMinutes: sum(rows, (r) => r.regularMinutes + r.overtimeMinutes + r.leaveMinutes),
      regularCents: sum(rows, (r) => r.regularCents),
      overtimeCents: sum(rows, (r) => r.overtimeCents),
      leaveCents: sum(rows, (r) => r.leaveCents),
      totalCents: sum(rows, (r) => r.totalCents),
      flags: {
        incomplete: rows.some((r) => r.incomplete),
        overtimeIncluded: rows.some((r) => r.overtimeMinutes > 0),
        edited: rows.some((r) => r.edited),
        rateChanged: periodRates.size > 0,
        workedAndLeaveSameDay,
      },
    };
    summaries.push(summary);
  }

  summaries.sort((a, b) => a.employeeId.localeCompare(b.employeeId));

  return { details, summaries };
}

function sum<T>(rows: T[], f: (row: T) => number): number {
  return rows.reduce((acc, r) => acc + f(r), 0);
}

function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
