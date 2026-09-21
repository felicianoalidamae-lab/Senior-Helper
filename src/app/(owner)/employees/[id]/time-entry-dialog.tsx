"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/error-text";
import { addTimeEntry, editTimeEntry } from "@/lib/actions/attendance";
import { zonedDateString } from "@/lib/time";
import type { AttendanceRow } from "@/lib/data/attendance";

function splitZoned(iso: string | null, timeZone: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const date = zonedDateString(d, timeZone);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return { date, time };
}

export function TimeEntryDialog({
  employeeId,
  timeZone,
  entry,
  open,
  onOpenChange,
}: {
  employeeId: string;
  timeZone: string;
  entry: AttendanceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const initialIn = splitZoned(entry?.clock_in ?? null, timeZone);
  const initialOut = splitZoned(entry?.clock_out ?? null, timeZone);

  const [clockInDate, setClockInDate] = useState(initialIn.date);
  const [clockInTime, setClockInTime] = useState(initialIn.time);
  const [clockOutDate, setClockOutDate] = useState(initialOut.date);
  const [clockOutTime, setClockOutTime] = useState(initialOut.time);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;
    if (open && !dialogEl.open) dialogEl.showModal();
    if (!open && dialogEl.open) dialogEl.close();
  }, [open]);

  useEffect(() => {
    if (open) {
      const inParts = splitZoned(entry?.clock_in ?? null, timeZone);
      const outParts = splitZoned(entry?.clock_out ?? null, timeZone);
      setClockInDate(inParts.date || zonedDateString(new Date(), timeZone));
      setClockInTime(inParts.time);
      setClockOutDate(outParts.date);
      setClockOutTime(outParts.time);
      setNote("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clockInDate || !clockInTime) {
      setError("Clock in date and time are required.");
      return;
    }
    if ((clockOutDate && !clockOutTime) || (!clockOutDate && clockOutTime)) {
      setError("Enter both a clock out date and time, or leave both blank.");
      return;
    }
    if (!note.trim()) {
      setError("A note is required.");
      return;
    }

    setLoading(true);
    const input = {
      employeeId,
      clockInDate,
      clockInTime,
      clockOutDate: clockOutDate || null,
      clockOutTime: clockOutTime || null,
      note,
      timeZone,
    };
    const result = entry ? await editTimeEntry(entry.id, input) : await addTimeEntry(input);
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "Couldn't save.");
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={() => onOpenChange(false)}
      className="w-full max-w-md rounded-xl border border-border bg-surface p-0 backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="p-5" noValidate>
        <h2 className="text-lg font-semibold text-ink">{entry ? "Edit time entry" : "Add time entry"}</h2>
        <p className="mt-1 text-sm text-muted">Times are in the business time zone ({timeZone}).</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="clock_in_date">
              Clock in date
            </label>
            <input id="clock_in_date" type="date" required className="input" value={clockInDate} onChange={(e) => setClockInDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="clock_in_time">
              Clock in time
            </label>
            <input id="clock_in_time" type="time" required className="input" value={clockInTime} onChange={(e) => setClockInTime(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="clock_out_date">
              Clock out date
            </label>
            <input id="clock_out_date" type="date" className="input" value={clockOutDate} onChange={(e) => setClockOutDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="clock_out_time">
              Clock out time
            </label>
            <input id="clock_out_time" type="time" className="input" value={clockOutTime} onChange={(e) => setClockOutTime(e.target.value)} />
          </div>
        </div>
        <p className="mt-1 text-xs text-muted">Leave clock out blank if this entry is still open.</p>

        <label className="label mt-4" htmlFor="note">
          Note (required)
        </label>
        <textarea
          id="note"
          required
          className="input min-h-[80px]"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why is this entry being added or changed?"
        />

        <ErrorText message={error} />

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => onOpenChange(false)} className="btn-outline flex-1">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
