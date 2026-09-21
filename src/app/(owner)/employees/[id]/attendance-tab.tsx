"use client";

import { useState } from "react";
import { formatDate, formatMinutes, formatTime } from "@/lib/format";
import { TimeEntryDialog } from "./time-entry-dialog";
import type { AttendanceRow } from "@/lib/data/attendance";

export function AttendanceTab({
  employeeId,
  rows,
  timeZone,
  autoOpenEntryId,
}: {
  employeeId: string;
  rows: AttendanceRow[];
  timeZone: string;
  autoOpenEntryId?: string;
}) {
  const [dialogEntry, setDialogEntry] = useState<AttendanceRow | null>(
    autoOpenEntryId ? rows.find((r) => r.id === autoOpenEntryId) ?? null : null
  );
  const [dialogOpen, setDialogOpen] = useState(!!autoOpenEntryId);
  const [addMode, setAddMode] = useState(false);

  function openEdit(row: AttendanceRow) {
    setDialogEntry(row);
    setAddMode(false);
    setDialogOpen(true);
  }
  function openAdd() {
    setDialogEntry(null);
    setAddMode(true);
    setDialogOpen(true);
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">Attendance — last 30 days</h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted">Times shown in {timeZone}</p>
          <button type="button" className="btn-outline min-h-[36px] px-3 text-sm" onClick={openAdd}>
            Add entry
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-muted">No time entries in this period.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Clock in</th>
                <th className="py-2 pr-3 font-medium">Clock out</th>
                <th className="py-2 pr-3 font-medium">Break</th>
                <th className="py-2 pr-3 font-medium">Worked</th>
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3">{formatDate(row.work_date, timeZone)}</td>
                  <td className="py-2 pr-3">{formatTime(row.clock_in, timeZone)}</td>
                  <td className="py-2 pr-3">
                    {row.clock_out ? (
                      formatTime(row.clock_out, timeZone)
                    ) : (
                      <span className="text-status-declined">Missing</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{row.breakMinutes > 0 ? formatMinutes(row.breakMinutes) : "—"}</td>
                  <td className="py-2 pr-3">{row.workedMinutes != null ? formatMinutes(row.workedMinutes) : "—"}</td>
                  <td className="py-2 pr-3">
                    {row.source === "manual" ? (
                      <span className="chip bg-purple-50 text-status-leave" title={row.edit_note ?? undefined}>
                        Edited
                      </span>
                    ) : (
                      "Live"
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <button type="button" className="text-sm text-brand-blue hover:underline" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TimeEntryDialog
        employeeId={employeeId}
        timeZone={timeZone}
        entry={addMode ? null : dialogEntry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
