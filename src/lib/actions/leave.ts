"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LeaveType } from "@/lib/supabase/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function submitLeaveRequest(input: {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (input.endDate < input.startDate) {
    return { ok: false, error: "End date must be on or after the start date." };
  }
  if (!input.reason.trim()) {
    return { ok: false, error: "A reason is required." };
  }
  if (input.reason.length > 500) {
    return { ok: false, error: "Reason must be 500 characters or fewer." };
  }

  const { error } = await supabase.from("leave_requests").insert({
    employee_id: user.id,
    type: input.type,
    start_date: input.startDate,
    end_date: input.endDate,
    reason: input.reason.trim(),
    status: "pending",
  });

  if (error) return { ok: false, error: "Couldn't submit your request. Try again." };
  revalidatePath("/leave");
  return { ok: true };
}

export async function cancelMyLeaveRequest(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_leave_request", { p_id: id });
  if (error) return { ok: false, error: "Couldn't cancel this request." };
  revalidatePath("/leave");
  return { ok: true };
}
