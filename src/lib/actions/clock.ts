"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const FRIENDLY_ERRORS: Record<string, string> = {
  "You are already clocked in.": "You're already clocked in.",
  "You are not clocked in.": "You're not clocked in right now.",
  "You are already on a break.": "You're already on a break.",
  "You are not on a break.": "You're not on a break right now.",
  "Only active employees can clock in.": "Your account isn't active. Ask the owner for help.",
};

function friendlyError(message: string | undefined): string {
  if (!message) return "Couldn't save. Check your connection and try again.";
  return FRIENDLY_ERRORS[message] ?? "Couldn't save. Check your connection and try again.";
}

export async function clockIn(): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("clock_in");
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/clock");
  revalidatePath("/team");
  return { ok: true };
}

export async function startBreak(): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("start_break");
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/clock");
  revalidatePath("/team");
  return { ok: true };
}

export async function endBreak(): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("end_break");
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/clock");
  revalidatePath("/team");
  return { ok: true };
}

export async function clockOut(): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("clock_out");
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/clock");
  revalidatePath("/history");
  revalidatePath("/team");
  return { ok: true };
}
