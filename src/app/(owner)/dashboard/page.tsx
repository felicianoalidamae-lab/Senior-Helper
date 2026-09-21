import Link from "next/link";
import { getDashboardData } from "@/lib/data/dashboard";
import { LiveBoard } from "@/components/live-board";
import { formatDateTime } from "@/lib/format";
import type { DashboardEmployee } from "@/lib/data/dashboard";

const GROUP_META: { status: DashboardEmployee["status"]; label: string; dotClass: string }[] = [
  { status: "working", label: "Available", dotClass: "bg-status-working" },
  { status: "on_break", label: "On break", dotClass: "bg-status-break" },
  { status: "on_leave", label: "On leave", dotClass: "bg-status-leave" },
  { status: "not_in", label: "Not in yet", dotClass: "bg-status-off" },
  { status: "clocked_out", label: "Clocked out", dotClass: "bg-status-off" },
];

export default async function DashboardPage() {
  const data = await getDashboardData();
  const renderedAt = Date.now();

  return (
    <LiveBoard renderedAt={renderedAt}>
      <h1 className="text-xl font-semibold text-ink">Today</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {GROUP_META.map((g) => {
          const count = data.employees.filter((e) => e.status === g.status).length;
          return (
            <div key={g.status} className="card text-center">
              <p className="text-2xl font-bold text-ink">{count}</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted">
                <span className={`h-2 w-2 rounded-full ${g.dotClass}`} aria-hidden="true" />
                {g.label}
              </p>
            </div>
          );
        })}
      </div>

      {data.pendingLeaveCount > 0 && (
        <Link
          href="/leave-requests"
          className="mt-4 flex items-center justify-between rounded-xl border border-border bg-surface p-4 hover:bg-background"
        >
          <span className="font-medium text-ink">Pending leave requests</span>
          <span className="chip bg-amber-50 text-status-break">{data.pendingLeaveCount}</span>
        </Link>
      )}

      {data.needsAttention.length > 0 && (
        <div className="card mt-4 border-red-200 bg-red-50">
          <h2 className="font-semibold text-status-declined">Needs attention</h2>
          <ul className="mt-3 space-y-2">
            {data.needsAttention.map((row) => (
              <li key={row.entryId} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium text-ink">{row.fullName}</span>{" "}
                  <span className="text-muted">
                    has been clocked in since {formatDateTime(row.clockIn, data.timeZone)} (
                    {Math.round(row.hoursOpen)}h)
                  </span>
                </span>
                <Link href={`/employees/${row.employeeId}?fixEntry=${row.entryId}`} className="btn-outline min-h-[36px] px-3 text-sm">
                  Fix
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {GROUP_META.map((g) => {
          const rows = data.employees.filter((e) => e.status === g.status);
          if (rows.length === 0) return null;
          return (
            <div key={g.status}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <span className={`h-2 w-2 rounded-full ${g.dotClass}`} aria-hidden="true" />
                {g.label} ({rows.length})
              </h2>
              <div className="card divide-y divide-border p-0">
                {rows.map((row) => (
                  <Link
                    key={row.id}
                    href={`/employees/${row.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background"
                  >
                    <span>
                      <span className="font-medium text-ink">{row.full_name}</span>
                      {row.position ? <span className="ml-2 text-sm text-muted">{row.position}</span> : null}
                    </span>
                    {row.detail ? <span className="text-sm text-muted">{row.detail}</span> : null}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </LiveBoard>
  );
}
