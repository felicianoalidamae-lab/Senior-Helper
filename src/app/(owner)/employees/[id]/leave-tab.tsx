import { formatDate } from "@/lib/format";
import { LEAVE_STATUS_CHIP_CLASS, LEAVE_TYPE_LABEL, capitalize, summarizeApprovedLeave } from "@/lib/leave";
import type { LeaveRequest } from "@/lib/supabase/types";

export function LeaveTab({ requests, workDays }: { requests: LeaveRequest[]; workDays: number[] }) {
  const daysByType = summarizeApprovedLeave(requests, workDays);

  return (
    <div className="card">
      <h2 className="font-semibold text-ink">Leave</h2>
      <p className="mt-1 text-sm text-muted">
        Approved this year: Vacation {daysByType.vacation} days · Sick {daysByType.sick} days · Emergency{" "}
        {daysByType.emergency} days
      </p>

      {requests.length === 0 ? (
        <p className="mt-4 text-muted">No leave requests yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Dates</th>
                <th className="py-2 pr-3 font-medium">Reason</th>
                <th className="py-2 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3">{LEAVE_TYPE_LABEL[r.type]}</td>
                  <td className="py-2 pr-3">
                    {formatDate(r.start_date)}
                    {r.end_date !== r.start_date ? ` – ${formatDate(r.end_date)}` : ""}
                  </td>
                  <td className="py-2 pr-3 text-muted">{r.reason}</td>
                  <td className="py-2 pr-3">
                    <span className={`chip ${LEAVE_STATUS_CHIP_CLASS[r.status]}`}>{capitalize(r.status)}</span>
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
