import { notFound } from "next/navigation";
import Link from "next/link";
import { getEmployeeDetail } from "@/lib/data/employees";
import { getAttendanceForEmployee } from "@/lib/data/attendance";
import { getSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { ProfileTab } from "./profile-tab";
import { AttendanceTab } from "./attendance-tab";
import { LeaveTab } from "./leave-tab";
import { Tabs } from "./tabs";

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const detail = await getEmployeeDetail(params.id);
  if (!detail) notFound();

  const settings = await getSettings();
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [attendance, { data: leaveRequests }] = await Promise.all([
    getAttendanceForEmployee(params.id, fromDate, toDate, settings.breaks_unpaid),
    createClient()
      .from("leave_requests")
      .select("*")
      .eq("employee_id", params.id)
      .order("start_date", { ascending: false }),
  ]);

  return (
    <div>
      <Link href="/employees" className="text-sm text-brand-blue hover:underline">
        ← All employees
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">{detail.profile.full_name}</h1>
      <p className="text-muted">{detail.profile.position ?? "No position set"}</p>

      <div className="mt-6">
        <Tabs
          tabs={[
            { label: "Profile", content: <ProfileTab profile={detail.profile} rates={detail.rates} /> },
            {
              label: "Attendance history",
              content: <AttendanceTab rows={attendance} timeZone={settings.timezone} />,
            },
            {
              label: "Leave",
              content: <LeaveTab requests={leaveRequests ?? []} workDays={settings.work_days} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
