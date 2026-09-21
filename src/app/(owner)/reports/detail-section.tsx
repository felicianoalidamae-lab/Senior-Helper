import { formatCents, formatDate, formatMinutes, formatTime } from "@/lib/format";
import { LEAVE_TYPE_LABEL } from "@/lib/leave";
import type { DayDetailRow, EmployeeSummary } from "@/lib/payroll";

export function DetailSection({
  summary,
  rows,
  employeeName,
  timeZone,
}: {
  summary: EmployeeSummary;
  rows: DayDetailRow[];
  employeeName: string;
  timeZone: string;
}) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold text-ink">
        {employeeName} — {formatCents(summary.totalCents)}
      </summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Clock in</th>
              <th className="py-2 pr-3 font-medium">Clock out</th>
              <th className="py-2 pr-3 font-medium">Break</th>
              <th className="py-2 pr-3 font-medium">Worked</th>
              <th className="py-2 pr-3 font-medium">Regular</th>
              <th className="py-2 pr-3 font-medium">Overtime</th>
              <th className="py-2 pr-3 font-medium">Leave</th>
              <th className="py-2 pr-3 font-medium">Rate</th>
              <th className="py-2 pr-3 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="py-2 pr-3">{formatDate(row.date)}</td>
                {row.kind === "leave" ? (
                  <td className="py-2 pr-3 text-status-leave" colSpan={3}>
                    {LEAVE_TYPE_LABEL[row.leaveType ?? "vacation"]} leave (approved)
                  </td>
                ) : (
                  <>
                    <td className="py-2 pr-3">{row.clockIn ? formatTime(row.clockIn, timeZone) : row.incomplete ? "Missing" : "—"}</td>
                    <td className="py-2 pr-3">
                      {row.clockOut ? (
                        formatTime(row.clockOut, timeZone)
                      ) : row.incomplete ? (
                        <span className="text-status-declined">Missing</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3">{row.breakMinutes ? formatMinutes(row.breakMinutes) : "—"}</td>
                  </>
                )}
                <td className="py-2 pr-3">{formatMinutes(row.regularMinutes + row.overtimeMinutes)}</td>
                <td className="py-2 pr-3">{formatMinutes(row.regularMinutes)}</td>
                <td className="py-2 pr-3">{formatMinutes(row.overtimeMinutes)}</td>
                <td className="py-2 pr-3">{formatMinutes(row.leaveMinutes)}</td>
                <td className="py-2 pr-3">{formatCents(row.rateCents)}/hr</td>
                <td className="py-2 pr-3 font-medium text-ink">
                  {formatCents(row.totalCents)}
                  {row.edited && (
                    <span className="chip ml-1 bg-purple-50 text-status-leave" style={{ padding: "0 6px" }}>
                      Edited
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
