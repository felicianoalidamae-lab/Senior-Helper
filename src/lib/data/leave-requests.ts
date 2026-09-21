import { createClient } from "@/lib/supabase/server";
import { businessToday } from "@/lib/time";
import type { LeaveRequest } from "@/lib/supabase/types";

export interface LeaveRequestWithName extends LeaveRequest {
  employee_name: string;
}

export interface LeaveRequestsData {
  pending: LeaveRequestWithName[];
  approvedUpcoming: LeaveRequestWithName[];
  history: LeaveRequestWithName[];
}

export async function getLeaveRequestsData(): Promise<LeaveRequestsData> {
  const supabase = createClient();
  const settings = await supabase.from("settings").select("timezone").single();
  const today = businessToday(settings.data?.timezone ?? "America/New_York");

  const [{ data: requests }, { data: profiles }] = await Promise.all([
    supabase.from("leave_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const withNames: LeaveRequestWithName[] = (requests ?? []).map((r) => ({
    ...r,
    employee_name: nameById.get(r.employee_id) ?? "Unknown",
  }));

  return {
    pending: withNames.filter((r) => r.status === "pending"),
    approvedUpcoming: withNames.filter((r) => r.status === "approved" && r.end_date >= today),
    history: withNames.filter(
      (r) => r.status === "declined" || r.status === "cancelled" || (r.status === "approved" && r.end_date < today)
    ),
  };
}
