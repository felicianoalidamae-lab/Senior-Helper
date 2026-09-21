import { formatCents, formatMinutes } from "@/lib/format";
import type { EmployeeSummary } from "@/lib/payroll";

const FLAG_META: { key: keyof EmployeeSummary["flags"]; icon: string; label: string }[] = [
  { key: "incomplete", icon: "⚠", label: "Incomplete entry — hours excluded until fixed" },
  { key: "overtimeIncluded", icon: "⏱", label: "Overtime included" },
  { key: "edited", icon: "✎", label: "Contains edited entries" },
  { key: "rateChanged", icon: "$", label: "Rate changed during this period" },
  { key: "workedAndLeaveSameDay", icon: "◆", label: "Worked and on leave the same day" },
];

export function SummaryTable({
  summaries,
  employeeNames,
  employeePositions,
  employeeRates,
}: {
  summaries: EmployeeSummary[];
  employeeNames: Map<string, string>;
  employeePositions: Map<string, string | null>;
  employeeRates: Map<string, number>;
}) {
  const totals = summaries.reduce(
    (acc, s) => ({
      days: acc.days + s.daysWorked,
      regular: acc.regular + s.regularMinutes,
      overtime: acc.overtime + s.overtimeMinutes,
      leave: acc.leave + s.leaveMinutes,
      regularCents: acc.regularCents + s.regularCents,
      overtimeCents: acc.overtimeCents + s.overtimeCents,
      totalCents: acc.totalCents + s.totalCents,
    }),
    { days: 0, regular: 0, overtime: 0, leave: 0, regularCents: 0, overtimeCents: 0, totalCents: 0 }
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted">
            <th className="py-2 pr-3 font-medium">Employee</th>
            <th className="py-2 pr-3 font-medium">Position</th>
            <th className="py-2 pr-3 font-medium">Rate</th>
            <th className="py-2 pr-3 font-medium">Days</th>
            <th className="py-2 pr-3 font-medium">Regular</th>
            <th className="py-2 pr-3 font-medium">Overtime</th>
            <th className="py-2 pr-3 font-medium">Leave</th>
            <th className="py-2 pr-3 font-medium">Total hrs</th>
            <th className="py-2 pr-3 font-medium">Regular pay</th>
            <th className="py-2 pr-3 font-medium">Overtime pay</th>
            <th className="py-2 pr-3 font-medium">Amount to pay</th>
            <th className="py-2 pr-3 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => (
            <tr key={s.employeeId} className="border-b border-border last:border-0">
              <td className="py-2 pr-3 font-medium text-ink">{employeeNames.get(s.employeeId) ?? "Unknown"}</td>
              <td className="py-2 pr-3 text-muted">{employeePositions.get(s.employeeId) ?? "—"}</td>
              <td className="py-2 pr-3">
                {employeeRates.has(s.employeeId) ? `${formatCents(employeeRates.get(s.employeeId)!)}/hr` : "—"}
              </td>
              <td className="py-2 pr-3">{s.daysWorked}</td>
              <td className="py-2 pr-3">{formatMinutes(s.regularMinutes)}</td>
              <td className="py-2 pr-3">{formatMinutes(s.overtimeMinutes)}</td>
              <td className="py-2 pr-3">{formatMinutes(s.leaveMinutes)}</td>
              <td className="py-2 pr-3">{formatMinutes(s.regularMinutes + s.overtimeMinutes + s.leaveMinutes)}</td>
              <td className="py-2 pr-3">{formatCents(s.regularCents)}</td>
              <td className="py-2 pr-3">{formatCents(s.overtimeCents)}</td>
              <td className="py-2 pr-3 font-semibold text-ink">{formatCents(s.totalCents)}</td>
              <td className="py-2 pr-3">
                <div className="flex gap-1">
                  {FLAG_META.filter((f) => s.flags[f.key]).map((f) => (
                    <span key={f.key} title={f.label} className="cursor-help text-brand-purple" aria-label={f.label}>
                      {f.icon}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        {summaries.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-border font-semibold text-ink">
              <td className="py-2 pr-3" colSpan={3}>
                Total
              </td>
              <td className="py-2 pr-3">{totals.days}</td>
              <td className="py-2 pr-3">{formatMinutes(totals.regular)}</td>
              <td className="py-2 pr-3">{formatMinutes(totals.overtime)}</td>
              <td className="py-2 pr-3">{formatMinutes(totals.leave)}</td>
              <td className="py-2 pr-3">{formatMinutes(totals.regular + totals.overtime + totals.leave)}</td>
              <td className="py-2 pr-3">{formatCents(totals.regularCents)}</td>
              <td className="py-2 pr-3">{formatCents(totals.overtimeCents)}</td>
              <td className="py-2 pr-3">{formatCents(totals.totalCents)}</td>
              <td></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
