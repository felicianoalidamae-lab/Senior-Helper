import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { getAttendanceForEmployee } from "@/lib/data/attendance";
import { resolvePeriod } from "@/lib/resolve-period";
import { PeriodSelector } from "@/components/period-selector";
import { formatDate, formatMinutes, formatTime } from "@/lib/format";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const settings = await getSettings();
  const range = resolvePeriod(searchParams, settings);
  const rows = await getAttendanceForEmployee(user.id, range.start, range.end, settings.breaks_unpaid);

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">History</h1>
      <div className="card mt-4">
        <PeriodSelector />
        <p className="mt-3 text-sm text-muted">
          {formatDate(range.start)} – {formatDate(range.end)} · Times shown in your device time zone
        </p>

        {rows.length === 0 ? (
          <p className="mt-4 text-muted">No time entries in this period.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Clock in</th>
                  <th className="py-2 pr-3 font-medium">Clock out</th>
                  <th className="py-2 pr-3 font-medium">Break</th>
                  <th className="py-2 pr-3 font-medium">Worked</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3">{formatDate(row.work_date)}</td>
                    <td className="py-2 pr-3">{formatTime(row.clock_in)}</td>
                    <td className="py-2 pr-3">
                      {row.clock_out ? formatTime(row.clock_out) : <span className="text-status-declined">Missing</span>}
                    </td>
                    <td className="py-2 pr-3">{row.breakMinutes > 0 ? formatMinutes(row.breakMinutes) : "—"}</td>
                    <td className="py-2 pr-3">{row.workedMinutes != null ? formatMinutes(row.workedMinutes) : "—"}</td>
                    <td className="py-2 pr-3">
                      {row.source === "manual" ? (
                        <span className="chip bg-purple-50 text-status-leave" title={row.edit_note ?? undefined}>
                          Edited
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
