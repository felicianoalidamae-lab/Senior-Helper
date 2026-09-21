"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideLeaveRequest } from "@/lib/actions/leave-requests";
import { formatDate } from "@/lib/format";
import { LEAVE_TYPE_LABEL } from "@/lib/leave";
import { countWorkDays } from "@/lib/leave";
import type { LeaveRequestWithName } from "@/lib/data/leave-requests";

export function PendingRow({ request, workDays }: { request: LeaveRequestWithName; workDays: number[] }) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const days = countWorkDays(request.start_date, request.end_date, workDays);

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await decideLeaveRequest(request.id, "approved", null);
      if (!result.ok) setError(result.error ?? "Couldn't approve.");
      else router.refresh();
    });
  }

  function decline() {
    setError(null);
    if (!note.trim()) {
      setError("A note is required to decline.");
      return;
    }
    startTransition(async () => {
      const result = await decideLeaveRequest(request.id, "declined", note);
      if (!result.ok) setError(result.error ?? "Couldn't decline.");
      else router.refresh();
    });
  }

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-ink">{request.employee_name}</span>
        <span className="chip bg-amber-50 text-status-break">{LEAVE_TYPE_LABEL[request.type]}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {formatDate(request.start_date)}
        {request.end_date !== request.start_date ? ` – ${formatDate(request.end_date)}` : ""} · {days} day
        {days === 1 ? "" : "s"} · Requested {formatDate(request.created_at.slice(0, 10))}
      </p>
      <p className="mt-2 text-sm text-ink">{request.reason}</p>

      {error && <p className="mt-2 text-sm text-status-declined">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={isPending} onClick={approve} className="btn-primary min-h-[40px] px-4 text-sm">
          Approve
        </button>
        {declining ? (
          <>
            <input
              className="input min-w-[200px] flex-1"
              placeholder="Reason for declining (required)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button type="button" disabled={isPending} onClick={decline} className="btn-outline min-h-[40px] px-4 text-sm">
              Confirm decline
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setDeclining(true)}
            className="btn-outline min-h-[40px] px-4 text-sm"
          >
            Decline
          </button>
        )}
      </div>
    </li>
  );
}
