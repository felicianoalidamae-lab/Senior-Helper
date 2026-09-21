import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { LeaveRequestForm } from "./leave-request-form";
import { LeaveRequestList } from "./leave-request-list";

export default async function LeavePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [settings, { data: requests }] = await Promise.all([
    getSettings(),
    supabase
      .from("leave_requests")
      .select("*")
      .eq("employee_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">Time off</h1>
      <div className="mt-4">
        <LeaveRequestForm workDays={settings.work_days} />
        <LeaveRequestList requests={requests ?? []} workDays={settings.work_days} />
      </div>
    </div>
  );
}
