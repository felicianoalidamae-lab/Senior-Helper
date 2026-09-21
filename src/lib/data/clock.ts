import { createClient } from "@/lib/supabase/server";
import { businessToday, workweekRange } from "@/lib/time";
import type { BreakRow, CurrentStatus, TimeEntry } from "@/lib/supabase/types";

export interface ClockPageData {
  status: CurrentStatus;
  openEntry: (TimeEntry & { breaks: BreakRow[] }) | null;
  missedClockOutDate: string | null;
  todayEntries: (TimeEntry & { breaks: BreakRow[] })[];
  weeklyMinutesExcludingOpen: number;
  weeklyThresholdMinutes: number;
  shiftTargetMinutes: number;
  breaksUnpaid: boolean;
  onApprovedLeaveToday: boolean;
}

function workedMinutes(entry: TimeEntry, breaks: BreakRow[], breaksUnpaid: boolean): number {
  if (!entry.clock_out) return 0;
  const total = Math.floor(
    (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60000
  );
  if (!breaksUnpaid) return total;
  const breakMinutes = breaks.reduce((sum, b) => {
    if (!b.break_end) return sum;
    return sum + Math.floor((new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000);
  }, 0);
  return total - breakMinutes;
}

export async function getClockPageData(employeeId: string): Promise<ClockPageData> {
  const supabase = createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("timezone, shift_target_minutes, breaks_unpaid, week_start_day, weekly_ot_threshold_minutes")
    .single();

  const timeZone = settings?.timezone ?? "America/New_York";
  const today = businessToday(timeZone);
  const { start: weekStart, end: weekEnd } = workweekRange(today, settings?.week_start_day ?? 1);

  const { data: statusResult } = await supabase.rpc("current_status");
  const status = (statusResult as CurrentStatus) ?? "not_in";

  const { data: openEntryRow } = await supabase
    .from("time_entries")
    .select("*")
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .maybeSingle();

  const { data: weekEntries } = await supabase
    .from("time_entries")
    .select("*")
    .eq("employee_id", employeeId)
    .gte("work_date", weekStart)
    .lte("work_date", weekEnd)
    .not("clock_out", "is", null);

  const entryIds = [
    ...(openEntryRow ? [openEntryRow.id] : []),
    ...(weekEntries ?? []).map((e) => e.id),
  ];

  const { data: allBreaks } = entryIds.length
    ? await supabase.from("breaks").select("*").in("time_entry_id", entryIds)
    : { data: [] as BreakRow[] };

  const breaksByEntry = new Map<string, BreakRow[]>();
  for (const b of allBreaks ?? []) {
    const list = breaksByEntry.get(b.time_entry_id) ?? [];
    list.push(b);
    breaksByEntry.set(b.time_entry_id, list);
  }

  const breaksUnpaid = settings?.breaks_unpaid ?? true;

  const weeklyMinutesExcludingOpen = (weekEntries ?? []).reduce(
    (sum, e) => sum + workedMinutes(e, breaksByEntry.get(e.id) ?? [], breaksUnpaid),
    0
  );

  const openEntry = openEntryRow ? { ...openEntryRow, breaks: breaksByEntry.get(openEntryRow.id) ?? [] } : null;
  const missedClockOutDate = openEntry && openEntry.work_date !== today ? openEntry.work_date : null;

  const { data: todayEntriesRaw } = await supabase
    .from("time_entries")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("work_date", today)
    .order("clock_in", { ascending: true });

  const todayEntryIds = (todayEntriesRaw ?? []).map((e) => e.id);
  const { data: todayBreaks } = todayEntryIds.length
    ? await supabase.from("breaks").select("*").in("time_entry_id", todayEntryIds)
    : { data: [] as BreakRow[] };
  const todayBreaksByEntry = new Map<string, BreakRow[]>();
  for (const b of todayBreaks ?? []) {
    const list = todayBreaksByEntry.get(b.time_entry_id) ?? [];
    list.push(b);
    todayBreaksByEntry.set(b.time_entry_id, list);
  }
  const todayEntries = (todayEntriesRaw ?? []).map((e) => ({
    ...e,
    breaks: todayBreaksByEntry.get(e.id) ?? [],
  }));

  const { data: leaveToday } = await supabase
    .from("leave_requests")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();

  return {
    status,
    openEntry,
    missedClockOutDate,
    todayEntries,
    weeklyMinutesExcludingOpen,
    weeklyThresholdMinutes: settings?.weekly_ot_threshold_minutes ?? 2400,
    shiftTargetMinutes: settings?.shift_target_minutes ?? 480,
    breaksUnpaid,
    onApprovedLeaveToday: !!leaveToday,
  };
}
