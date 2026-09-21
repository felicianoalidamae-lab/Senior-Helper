"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/error-text";
import { submitLeaveRequest } from "@/lib/actions/leave";
import { countWorkDays } from "@/lib/leave";
import type { LeaveType } from "@/lib/supabase/types";

export function LeaveRequestForm({ workDays }: { workDays: number[] }) {
  const router = useRouter();
  const [type, setType] = useState<LeaveType>("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dayCount = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0;
    return countWorkDays(startDate, endDate, workDays);
  }, [startDate, endDate, workDays]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!startDate || !endDate) {
      setError("Choose a start and end date.");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }
    if (!reason.trim()) {
      setError("Enter a reason.");
      return;
    }

    setLoading(true);
    const result = await submitLeaveRequest({ type, startDate, endDate, reason });
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "Couldn't submit your request.");
      return;
    }

    setStartDate("");
    setEndDate("");
    setReason("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card" noValidate>
      <h2 className="font-semibold text-ink">Request time off</h2>

      <label className="label mt-4" htmlFor="type">
        Type
      </label>
      <select id="type" className="input" value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
        <option value="emergency">Emergency leave</option>
        <option value="vacation">Vacation leave</option>
        <option value="sick">Sick leave</option>
      </select>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="start_date">
            From
          </label>
          <input
            id="start_date"
            type="date"
            required
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="end_date">
            To
          </label>
          <input
            id="end_date"
            type="date"
            required
            className="input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      {dayCount > 0 && <p className="mt-2 text-sm text-muted">{dayCount} leave day{dayCount === 1 ? "" : "s"} will be counted.</p>}

      <label className="label mt-4" htmlFor="reason">
        Reason
      </label>
      <textarea
        id="reason"
        required
        maxLength={500}
        className="input min-h-[100px]"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <p className="mt-1 text-right text-xs text-muted">{reason.length}/500</p>

      <ErrorText message={error} />

      <button type="submit" disabled={loading} className="btn-primary mt-2 w-full sm:w-auto">
        {loading ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}
