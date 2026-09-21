import { formatDate } from "@/lib/format";
import { countWorkDays } from "@/lib/leave";
import type { LeaveRequest, LeaveType } from "@/lib/supabase/types";

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-amber-50 text-status-break",
  approved: "bg-green-50 text-status-working",
  declined: "bg-red-50 text-status-declined",
  cancelled: "bg-gray-100 text-status-off",
};

const TYPE_LABEL: Record<LeaveType, string> = {
  sick: "Sick",
  emergency: "Emergency",
  vacation: "Vacation",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function LeaveTab({ requests, workDays }: { requests: LeaveRequest[]; workDays: number[] }) {
  const thisYear = new Date().getUTCFullYear();
  const daysByType: Record<LeaveType, number> = { sick: 0, emergency: 0, vacation: 0 };
  for (const r of requests) {
    if (r.status !== "approved") continue;
    if (new Date(r.start_date).getUTCFullYear() !== thisYear) continue;
    daysByType[r.type] += countWorkDays(r.start_date, r.end_date, workDays);
  }

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
                  <td className="py-2 pr-3">{TYPE_LABEL[r.type]}</td>
                  <td className="py-2 pr-3">
                    {formatDate(r.start_date)}
                    {r.end_date !== r.start_date ? ` – ${formatDate(r.end_date)}` : ""}
                  </td>
                  <td className="py-2 pr-3 text-muted">{r.reason}</td>
                  <td className="py-2 pr-3">
                    <span className={`chip ${STATUS_CHIP[r.status]}`}>{capitalize(r.status)}</span>
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
