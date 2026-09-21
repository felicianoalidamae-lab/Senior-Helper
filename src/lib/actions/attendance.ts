"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { zonedTimeToUtc } from "@/lib/time";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

interface EntryInput {
  employeeId: string;
  clockInDate: string;
  clockInTime: string;
  clockOutDate: string | null;
  clockOutTime: string | null;
  note: string;
  timeZone: string;
}

export async function addTimeEntry(input: EntryInput): Promise<ActionResult> {
  const supabase = createClient();
  const clockIn = zonedTimeToUtc(input.clockInDate, input.clockInTime, input.timeZone);
  const clockOut =
    input.clockOutDate && input.clockOutTime
      ? zonedTimeToUtc(input.clockOutDate, input.clockOutTime, input.timeZone)
      : null;

  const { error } = await supabase.rpc("admin_add_time_entry", {
    p_employee_id: input.employeeId,
    p_clock_in: clockIn.toISOString(),
    p_clock_out: clockOut ? clockOut.toISOString() : null,
    p_note: input.note,
  });

  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(`/employees/${input.employeeId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function editTimeEntry(entryId: string, input: EntryInput): Promise<ActionResult> {
  const supabase = createClient();
  const clockIn = zonedTimeToUtc(input.clockInDate, input.clockInTime, input.timeZone);
  const clockOut =
    input.clockOutDate && input.clockOutTime
      ? zonedTimeToUtc(input.clockOutDate, input.clockOutTime, input.timeZone)
      : null;

  const { error } = await supabase.rpc("admin_edit_time_entry", {
    p_id: entryId,
    p_clock_in: clockIn.toISOString(),
    p_clock_out: clockOut ? clockOut.toISOString() : null,
    p_note: input.note,
  });

  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(`/employees/${input.employeeId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

function friendlyError(message: string | undefined): string {
  if (!message) return "Couldn't save. Check your connection and try again.";
  if (message.includes("note is required")) return "A note is required.";
  if (message.includes("Clock out must be after")) return "Clock out must be after clock in.";
  return "Couldn't save. Check your connection and try again.";
}
