"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMyLeaveRequest } from "@/lib/actions/leave";
import { formatDate } from "@/lib/format";
import { LEAVE_STATUS_CHIP_CLASS, LEAVE_TYPE_LABEL, capitalize, summarizeApprovedLeave } from "@/lib/leave";
import type { LeaveRequest } from "@/lib/supabase/types";

export function LeaveRequestList({ requests, workDays }: { requests: LeaveRequest[]; workDays: number[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const daysByType = summarizeApprovedLeave(requests, workDays);

  function handleCancel(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await cancelMyLeaveRequest(id);
      if (!result.ok) setError(result.error ?? "Couldn't cancel.");
      else router.refresh();
    });
  }

  return (
    <div className="card mt-4">
      <h2 className="font-semibold text-ink">Your requests</h2>
      <p className="mt-1 text-sm text-muted">
        Approved this year: Vacation {daysByType.vacation} days · Sick {daysByType.sick} days · Emergency{" "}
        {daysByType.emergency} days
      </p>

      {error && <p className="mt-2 text-sm text-status-declined">{error}</p>}

      {requests.length === 0 ? (
        <p className="mt-4 text-muted">No requests yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{LEAVE_TYPE_LABEL[r.type]}</span>
                <span className={`chip ${LEAVE_STATUS_CHIP_CLASS[r.status]}`}>{capitalize(r.status)}</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {formatDate(r.start_date)}
                {r.end_date !== r.start_date ? ` – ${formatDate(r.end_date)}` : ""}
              </p>
              <p className="mt-1 text-sm text-ink">{r.reason}</p>
              {r.decision_note && (
                <p className="mt-1 text-sm text-muted">Owner note: {r.decision_note}</p>
              )}
              {r.status === "pending" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleCancel(r.id)}
                  className="btn-outline mt-2 min-h-[36px] px-3 text-sm"
                >
                  Cancel request
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
