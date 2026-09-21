import { createClient } from "@/lib/supabase/server";
import type { TodayBoardRow } from "@/lib/supabase/types";

export async function getTeamBoard(): Promise<TodayBoardRow[]> {
  const supabase = createClient();
  const { data } = await supabase.rpc("today_board");
  return (data ?? []) as TodayBoardRow[];
}
