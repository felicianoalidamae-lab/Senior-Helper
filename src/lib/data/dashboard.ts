import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { businessToday } from "@/lib/time";
import { formatDate } from "@/lib/format";
import type { CurrentStatus, TimeEntry } from "@/lib/supabase/types";

export interface DashboardEmployee {
  id: string;
  full_name: string;
  position: string | null;
  status: CurrentStatus | "on_leave";
  detail: string | null;
}

export interface NeedsAttentionRow {
  entryId: string;
  employeeId: string;
  fullName: string;
  clockIn: string;
  hoursOpen: number;
}

export interface DashboardData {
  employees: DashboardEmployee[];
  needsAttention: NeedsAttentionRow[];
  pendingLeaveCount: number;
  timeZone: string;
}

const TYPE_LABEL: Record<string, string> = { sick: "Sick leave", emergency: "Emergency leave", vacation: "Vacation leave" };

function workedMinutesFor(clockIn: string, clockOut: string, breaks: { break_start: string; break_end: string | null }[], breaksUnpaid: boolean): number {
  const total = Math.floor((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000);
  if (!breaksUnpaid) return total;
  const breakMin = breaks.reduce((sum, b) => {
    if (!b.break_end) return sum;
    return sum + Math.floor((new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000);
  }, 0);
  return total - breakMin;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createClient();
  const settings = await getSettings();
  const today = businessToday(settings.timezone);

  const [{ data: profiles }, { data: openEntries }, { data: approvedLeave }, { data: todayClosedEntries }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, position")
        .eq("status", "active")
        .eq("role", "employee")
        .order("full_name"),
      supabase.from("time_entries").select("*").is("clock_out", null),
      supabase
        .from("leave_requests")
        .select("employee_id, type, start_date, end_date")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today),
      supabase.from("time_entries").select("*").eq("work_date", today).not("clock_out", "is", null),
    ]);

  const entryIds = [
    ...(openEntries ?? []).map((e) => e.id),
    ...(todayClosedEntries ?? []).map((e) => e.id),
  ];
  const { data: allBreaks } = entryIds.length
    ? await supabase.from("breaks").select("*").in("time_entry_id", entryIds)
    : { data: [] as { time_entry_id: string; break_start: string; break_end: string | null }[] };

  const breaksByEntry = new Map<string, { break_start: string; break_end: string | null }[]>();
  for (const b of allBreaks ?? []) {
    const list = breaksByEntry.get(b.time_entry_id) ?? [];
    list.push(b);
    breaksByEntry.set(b.time_entry_id, list);
  }

  const openByEmployee = new Map<string, TimeEntry>();
  for (const e of openEntries ?? []) openByEmployee.set(e.employee_id, e);

  const leaveByEmployee = new Map<string, { type: string; start_date: string; end_date: string }>();
  for (const l of approvedLeave ?? []) leaveByEmployee.set(l.employee_id, l);

  const todayWorkedByEmployee = new Map<string, number>();
  const lastClockOutByEmployee = new Map<string, string>();
  for (const e of todayClosedEntries ?? []) {
    const minutes = workedMinutesFor(e.clock_in, e.clock_out as string, breaksByEntry.get(e.id) ?? [], settings.breaks_unpaid);
    todayWorkedByEmployee.set(e.employee_id, (todayWorkedByEmployee.get(e.employee_id) ?? 0) + minutes);
    lastClockOutByEmployee.set(e.employee_id, e.clock_out as string);
  }

  const employees: DashboardEmployee[] = (profiles ?? []).map((p) => {
    const openEntry = openByEmployee.get(p.id);
    if (openEntry) {
      const hasOpenBreak = (breaksByEntry.get(openEntry.id) ?? []).some((b) => !b.break_end);
      if (hasOpenBreak) {
        const breakStart = (breaksByEntry.get(openEntry.id) ?? []).find((b) => !b.break_end)?.break_start;
        return {
          id: p.id,
          full_name: p.full_name,
          position: p.position,
          status: "on_break",
          detail: breakStart ? `Since ${new Date(breakStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: settings.timezone })}` : null,
        };
      }
      return {
        id: p.id,
        full_name: p.full_name,
        position: p.position,
        status: "working",
        detail: `In since ${new Date(openEntry.clock_in).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: settings.timezone })}`,
      };
    }

    const leave = leaveByEmployee.get(p.id);
    if (leave) {
      const dateLabel =
        leave.start_date === leave.end_date
          ? formatDate(leave.start_date)
          : `${formatDate(leave.start_date)} – ${formatDate(leave.end_date)}`;
      return {
        id: p.id,
        full_name: p.full_name,
        position: p.position,
        status: "on_leave",
        detail: `${TYPE_LABEL[leave.type] ?? "Leave"} · ${dateLabel}`,
      };
    }

    const workedToday = todayWorkedByEmployee.get(p.id);
    if (workedToday != null) {
      const h = Math.floor(workedToday / 60);
      const m = workedToday % 60;
      return {
        id: p.id,
        full_name: p.full_name,
        position: p.position,
        status: "clocked_out",
        detail: `Worked ${h}h ${m}m`,
      };
    }

    return { id: p.id, full_name: p.full_name, position: p.position, status: "not_in", detail: null };
  });

  const needsAttention: NeedsAttentionRow[] = (openEntries ?? [])
    .map((e) => {
      const hoursOpen = (Date.now() - new Date(e.clock_in).getTime()) / 3600000;
      const profile = (profiles ?? []).find((p) => p.id === e.employee_id);
      return {
        entryId: e.id,
        employeeId: e.employee_id,
        fullName: profile?.full_name ?? "Unknown",
        clockIn: e.clock_in,
        hoursOpen,
      };
    })
    .filter((row) => row.hoursOpen > 16);

  const { count: pendingLeaveCount } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return { employees, needsAttention, pendingLeaveCount: pendingLeaveCount ?? 0, timeZone: settings.timezone };
}
