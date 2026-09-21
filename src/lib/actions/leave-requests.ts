"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LeaveStatus } from "@/lib/supabase/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function decideLeaveRequest(
  id: string,
  decision: Extract<LeaveStatus, "approved" | "declined">,
  note: string | null
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("decide_leave_request", {
    p_id: id,
    p_decision: decision,
    p_note: note,
  });
  if (error) {
    const message = error.message.includes("note is required")
      ? "A note is required when declining."
      : "Couldn't save this decision.";
    return { ok: false, error: message };
  }
  revalidatePath("/leave-requests");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function cancelApprovedLeave(id: string, note: string | null): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_approved_leave", { p_id: id, p_note: note });
  if (error) return { ok: false, error: "Couldn't cancel this leave." };
  revalidatePath("/leave-requests");
  revalidatePath("/dashboard");
  return { ok: true };
}
