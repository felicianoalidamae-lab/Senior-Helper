"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelApprovedLeave } from "@/lib/actions/leave-requests";
import { formatDate } from "@/lib/format";
import { LEAVE_TYPE_LABEL } from "@/lib/leave";
import type { LeaveRequestWithName } from "@/lib/data/leave-requests";

export function ApprovedRow({ request }: { request: LeaveRequestWithName }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelApprovedLeave(request.id, "Cancelled by owner");
      if (!result.ok) setError(result.error ?? "Couldn't cancel.");
      else router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <span>
        <span className="font-medium text-ink">{request.employee_name}</span>{" "}
        <span className="chip bg-green-50 text-status-working">{LEAVE_TYPE_LABEL[request.type]}</span>{" "}
        <span className="text-sm text-muted">
          {formatDate(request.start_date)}
          {request.end_date !== request.start_date ? ` – ${formatDate(request.end_date)}` : ""}
        </span>
        {error && <span className="ml-2 text-sm text-status-declined">{error}</span>}
      </span>
      <button type="button" disabled={isPending} onClick={cancel} className="btn-outline min-h-[36px] px-3 text-sm">
        Cancel
      </button>
    </li>
  );
}
