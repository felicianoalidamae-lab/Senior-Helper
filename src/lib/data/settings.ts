import { createClient } from "@/lib/supabase/server";
import type { Settings } from "@/lib/supabase/types";

export async function getSettings(): Promise<Settings> {
  const supabase = createClient();
  const { data, error } = await supabase.from("settings").select("*").single();
  if (error || !data) {
    throw new Error("Couldn't load settings.");
  }
  return data;
}
