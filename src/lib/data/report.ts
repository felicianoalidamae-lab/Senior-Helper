import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { workweekRange } from "@/lib/time";
import { calculatePayroll, rateForDate, type PayrollResult, type RawLeaveRequest, type RawTimeEntry, type RateSchedule } from "@/lib/payroll";
import type { DateRange } from "@/lib/pay-period";
import type { Settings } from "@/lib/supabase/types";

export interface ReportData extends PayrollResult {
  employeeNames: Map<string, string>;
  employeePositions: Map<string, string | null>;
  employeeRates: Map<string, number>;
  settings: Settings;
  range: DateRange;
}

export async function getReportData(range: DateRange, employeeId?: string): Promise<ReportData> {
  const supabase = createClient();
  const settings = await getSettings();

  const widenedStart = workweekRange(range.start, settings.week_start_day).start;
  const widenedEnd = workweekRange(range.end, settings.week_start_day).end;

  let profileQuery = supabase.from("profiles").select("id, full_name, position").eq("role", "employee");
  if (employeeId) profileQuery = profileQuery.eq("id", employeeId);
  const { data: profiles } = await profileQuery;

  const employeeIds = (profiles ?? []).map((p) => p.id);
  if (employeeIds.length === 0) {
    return {
      details: [],
      summaries: [],
      employeeNames: new Map(),
      employeePositions: new Map(),
      employeeRates: new Map(),
      settings,
      range,
    };
  }

  const [{ data: entries }, { data: leaveRequests }, { data: rates }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("*")
      .in("employee_id", employeeIds)
      .gte("work_date", widenedStart)
      .lte("work_date", widenedEnd),
    supabase
      .from("leave_requests")
      .select("employee_id, type, start_date, end_date, status")
      .in("employee_id", employeeIds)
      .eq("status", "approved")
      .lte("start_date", range.end)
      .gte("end_date", range.start),
    supabase.from("pay_rates").select("*").in("employee_id", employeeIds).lte("effective_from", range.end),
  ]);

  const entryIds = (entries ?? []).map((e) => e.id);
  const { data: breaks } = entryIds.length
    ? await supabase.from("breaks").select("*").in("time_entry_id", entryIds)
    : { data: [] as { time_entry_id: string; break_start: string; break_end: string | null }[] };

  const breaksByEntry = new Map<string, { start: string; end: string | null }[]>();
  for (const b of breaks ?? []) {
    const list = breaksByEntry.get(b.time_entry_id) ?? [];
    list.push({ start: b.break_start, end: b.break_end });
    breaksByEntry.set(b.time_entry_id, list);
  }

  const rawEntries: RawTimeEntry[] = (entries ?? []).map((e) => ({
    id: e.id,
    employeeId: e.employee_id,
    clockIn: e.clock_in,
    clockOut: e.clock_out,
    breaks: breaksByEntry.get(e.id) ?? [],
    source: e.source as "live" | "manual",
  }));

  const rawLeave: RawLeaveRequest[] = (leaveRequests ?? []).map((l) => ({
    employeeId: l.employee_id,
    type: l.type,
    startDate: l.start_date,
    endDate: l.end_date,
    status: l.status,
  }));

  const rawRates: RateSchedule[] = (rates ?? []).map((r) => ({
    employeeId: r.employee_id,
    hourlyRateCents: r.hourly_rate_cents,
    effectiveFrom: r.effective_from,
  }));

  const result = calculatePayroll({
    entries: rawEntries,
    leaveRequests: rawLeave,
    rates: rawRates,
    settings: {
      timezone: settings.timezone,
      breaksUnpaid: settings.breaks_unpaid,
      shiftTargetMinutes: settings.shift_target_minutes,
      workDays: settings.work_days,
      paidLeaveTypes: settings.paid_leave_types,
      weekStartDay: settings.week_start_day,
      weeklyOtThresholdMinutes: settings.weekly_ot_threshold_minutes,
      dailyOtThresholdMinutes: settings.daily_ot_threshold_minutes,
      overtimeMultiplierPct: settings.overtime_multiplier_pct,
    },
    periodStart: range.start,
    periodEnd: range.end,
  });

  const employeeNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const employeePositions = new Map((profiles ?? []).map((p) => [p.id, p.position]));
  const employeeRates = new Map(
    employeeIds.map((id) => [id, rateForDate(rawRates, id, range.end)])
  );

  return { ...result, employeeNames, employeePositions, employeeRates, settings, range };
}
