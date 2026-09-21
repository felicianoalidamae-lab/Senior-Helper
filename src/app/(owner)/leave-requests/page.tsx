import { getLeaveRequestsData } from "@/lib/data/leave-requests";
import { getSettings } from "@/lib/data/settings";
import { formatDate } from "@/lib/format";
import { LEAVE_STATUS_CHIP_CLASS, LEAVE_TYPE_LABEL, capitalize } from "@/lib/leave";
import { PendingRow } from "./pending-row";
import { ApprovedRow } from "./approved-row";

export default async function LeaveRequestsPage() {
  const [data, settings] = await Promise.all([getLeaveRequestsData(), getSettings()]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">Leave requests</h1>

      <div className="card mt-4">
        <h2 className="font-semibold text-ink">Pending ({data.pending.length})</h2>
        {data.pending.length === 0 ? (
          <p className="mt-2 text-muted">Nothing waiting on you.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.pending.map((r) => (
              <PendingRow key={r.id} request={r} workDays={settings.work_days} />
            ))}
          </ul>
        )}
      </div>

      <div className="card mt-4">
        <h2 className="font-semibold text-ink">Approved (current &amp; upcoming)</h2>
        {data.approvedUpcoming.length === 0 ? (
          <p className="mt-2 text-muted">No upcoming approved leave.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.approvedUpcoming.map((r) => (
              <ApprovedRow key={r.id} request={r} />
            ))}
          </ul>
        )}
      </div>

      <div className="card mt-4">
        <h2 className="font-semibold text-ink">History</h2>
        {data.history.length === 0 ? (
          <p className="mt-2 text-muted">No past requests yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-3 font-medium">Employee</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Dates</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3">{r.employee_name}</td>
                    <td className="py-2 pr-3">{LEAVE_TYPE_LABEL[r.type]}</td>
                    <td className="py-2 pr-3">
                      {formatDate(r.start_date)}
                      {r.end_date !== r.start_date ? ` – ${formatDate(r.end_date)}` : ""}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`chip ${LEAVE_STATUS_CHIP_CLASS[r.status]}`}>{capitalize(r.status)}</span>
                    </td>
                    <td className="py-2 pr-3 text-muted">{r.decision_note ?? "—"}</td>
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
