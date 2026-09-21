"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LeaveType } from "@/lib/supabase/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface SettingsInput {
  business_name: string;
  timezone: string;
  pay_period_anchor: string;
  pay_period_days: number;
  shift_target_minutes: number;
  breaks_unpaid: boolean;
  work_days: number[];
  paid_leave_types: LeaveType[];
  week_start_day: number;
  weekly_ot_threshold_minutes: number;
  daily_ot_threshold_minutes: number | null;
  overtime_multiplier_pct: number;
}

export async function updateSettings(input: SettingsInput): Promise<ActionResult> {
  const supabase = createClient();

  if (input.work_days.length === 0) return { ok: false, error: "Select at least one work day." };
  if (input.pay_period_days < 1) return { ok: false, error: "Pay period length must be at least 1 day." };
  if (input.shift_target_minutes < 1) return { ok: false, error: "Shift length must be at least 1 minute." };

  const { error } = await supabase.from("settings").update(input).eq("id", true);
  if (error) return { ok: false, error: "Couldn't save settings. Try again." };

  revalidatePath("/settings");
  return { ok: true };
}

export async function setOwnerRole(userId: string, role: "owner" | "employee"): Promise<ActionResult> {
  const supabase = createClient();

  if (role === "employee") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "There must be at least one owner." };
    }
  }

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: "Couldn't update this person's role." };

  revalidatePath("/settings");
  return { ok: true };
}
