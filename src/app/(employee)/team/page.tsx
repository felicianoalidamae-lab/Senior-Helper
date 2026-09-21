import { getTeamBoard } from "@/lib/data/team";
import { getSettings } from "@/lib/data/settings";
import { LiveBoard } from "@/components/live-board";
import { StatusPill } from "@/components/status-pill";
import { formatTime } from "@/lib/format";
import type { CurrentStatus } from "@/lib/supabase/types";

export default async function TeamPage() {
  const [rows, settings] = await Promise.all([getTeamBoard(), getSettings()]);
  const renderedAt = Date.now();

  return (
    <LiveBoard renderedAt={renderedAt}>
      <h1 className="text-xl font-semibold text-ink">Team today</h1>
      <div className="card mt-4 divide-y divide-border p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-muted">No active team members.</p>
        ) : (
          rows.map((row) => (
            <div key={row.employee_id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="font-medium text-ink">{row.full_name}</span>
                {row.position ? <span className="ml-2 text-sm text-muted">{row.position}</span> : null}
              </span>
              <StatusPill
                status={row.status as CurrentStatus | "on_leave"}
                detail={row.since ? `since ${formatTime(row.since, settings.timezone)}` : undefined}
              />
            </div>
          ))
        )}
      </div>
    </LiveBoard>
  );
}
