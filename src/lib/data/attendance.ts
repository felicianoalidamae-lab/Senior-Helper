import { createClient } from "@/lib/supabase/server";
import type { BreakRow, TimeEntry } from "@/lib/supabase/types";

export interface AttendanceRow extends TimeEntry {
  breaks: BreakRow[];
  breakMinutes: number;
  workedMinutes: number | null;
}

export async function getAttendanceForEmployee(
  employeeId: string,
  fromDate: string,
  toDate: string,
  breaksUnpaid: boolean
): Promise<AttendanceRow[]> {
  const supabase = createClient();
  const { data: entries } = await supabase
    .from("time_entries")
    .select("*")
    .eq("employee_id", employeeId)
    .gte("work_date", fromDate)
    .lte("work_date", toDate)
    .order("work_date", { ascending: false });

  if (!entries || entries.length === 0) return [];

  const { data: breaks } = await supabase
    .from("breaks")
    .select("*")
    .in(
      "time_entry_id",
      entries.map((e) => e.id)
    );

  const breaksByEntry = new Map<string, BreakRow[]>();
  for (const b of breaks ?? []) {
    const list = breaksByEntry.get(b.time_entry_id) ?? [];
    list.push(b);
    breaksByEntry.set(b.time_entry_id, list);
  }

  return entries.map((entry) => {
    const entryBreaks = breaksByEntry.get(entry.id) ?? [];
    const breakMinutes = entryBreaks.reduce((sum, b) => {
      if (!b.break_end) return sum;
      return sum + Math.floor((new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000);
    }, 0);

    let workedMinutes: number | null = null;
    if (entry.clock_out) {
      const totalMinutes = Math.floor(
        (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60000
      );
      workedMinutes = breaksUnpaid ? totalMinutes - breakMinutes : totalMinutes;
    }

    return { ...entry, breaks: entryBreaks, breakMinutes, workedMinutes };
  });
}
