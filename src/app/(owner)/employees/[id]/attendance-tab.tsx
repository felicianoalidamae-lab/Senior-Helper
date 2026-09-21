import { formatDate, formatMinutes, formatTime } from "@/lib/format";
import type { AttendanceRow } from "@/lib/data/attendance";

export function AttendanceTab({ rows, timeZone }: { rows: AttendanceRow[]; timeZone: string }) {
  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">Attendance — last 30 days</h2>
        <p className="text-sm text-muted">Times shown in {timeZone}</p>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-muted">No time entries in this period.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Clock in</th>
                <th className="py-2 pr-3 font-medium">Clock out</th>
                <th className="py-2 pr-3 font-medium">Break</th>
                <th className="py-2 pr-3 font-medium">Worked</th>
                <th className="py-2 pr-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3">{formatDate(row.work_date, timeZone)}</td>
                  <td className="py-2 pr-3">{formatTime(row.clock_in, timeZone)}</td>
                  <td className="py-2 pr-3">
                    {row.clock_out ? (
                      formatTime(row.clock_out, timeZone)
                    ) : (
                      <span className="text-status-declined">Missing</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{row.breakMinutes > 0 ? formatMinutes(row.breakMinutes) : "—"}</td>
                  <td className="py-2 pr-3">{row.workedMinutes != null ? formatMinutes(row.workedMinutes) : "—"}</td>
                  <td className="py-2 pr-3">
                    {row.source === "manual" ? (
                      <span className="chip bg-purple-50 text-status-leave" title={row.edit_note ?? undefined}>
                        Edited
                      </span>
                    ) : (
                      "Live"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
