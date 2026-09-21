"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function updateEmployeeProfile(
  id: string,
  fields: {
    full_name: string;
    position: string | null;
    phone: string | null;
    start_date: string | null;
  }
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update(fields).eq("id", id);
  if (error) return { ok: false, error: "Couldn't save changes. Try again." };
  revalidatePath(`/employees/${id}`);
  return { ok: true };
}

export async function setEmployeeStatus(id: string, status: "active" | "inactive"): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update status. Try again." };
  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
  return { ok: true };
}

export async function addPayRate(
  employeeId: string,
  hourlyRateCents: number,
  effectiveFrom: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("pay_rates").insert({
    employee_id: employeeId,
    hourly_rate_cents: hourlyRateCents,
    effective_from: effectiveFrom,
  });
  if (error) {
    const message = error.code === "23505" ? "There's already a rate effective that date." : "Couldn't save the new rate. Try again.";
    return { ok: false, error: message };
  }
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  return { ok: true };
}
