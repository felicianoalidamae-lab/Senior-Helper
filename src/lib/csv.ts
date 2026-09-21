import type { ReportData } from "@/lib/data/report";

const DANGEROUS_PREFIXES = ["=", "+", "-", "@"];

function csvCell(value: string | number): string {
  let s = String(value);
  if (DANGEROUS_PREFIXES.some((p) => s.startsWith(p))) s = `'${s}`;
  if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function minutesToHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function formatClock(iso: string | undefined, timeZone: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

const LEAVE_TYPE_LABEL: Record<string, string> = { sick: "Sick", emergency: "Emergency", vacation: "Vacation" };

export function buildTimesheetCsv(data: ReportData): string {
  const header = [
    "Employee",
    "Position",
    "Date",
    "Type",
    "Clock in",
    "Clock out",
    "Break hours",
    "Worked hours",
    "Regular hours",
    "Overtime hours",
    "Leave hours",
    "Rate",
    "Amount",
  ];

  const rows: string[] = [header.map(csvCell).join(",")];

  for (const summary of data.summaries) {
    const name = data.employeeNames.get(summary.employeeId) ?? "Unknown";
    const position = data.employeePositions.get(summary.employeeId) ?? "";
    const detailRows = data.details
      .filter((d) => d.employeeId === summary.employeeId)
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const row of detailRows) {
      const workedMinutes = row.regularMinutes + row.overtimeMinutes;
      rows.push(
        [
          csvCell(name),
          csvCell(position ?? ""),
          csvCell(row.date),
          csvCell(row.kind === "leave" ? `${LEAVE_TYPE_LABEL[row.leaveType ?? ""] ?? "Leave"} leave` : "Worked"),
          csvCell(formatClock(row.clockIn, data.settings.timezone)),
          csvCell(formatClock(row.clockOut, data.settings.timezone)),
          csvCell(row.breakMinutes ? minutesToHours(row.breakMinutes) : "0.00"),
          csvCell(minutesToHours(workedMinutes)),
          csvCell(minutesToHours(row.regularMinutes)),
          csvCell(minutesToHours(row.overtimeMinutes)),
          csvCell(minutesToHours(row.leaveMinutes)),
          csvCell(centsToDollars(row.rateCents)),
          csvCell(centsToDollars(row.totalCents)),
        ].join(",")
      );
    }

    rows.push(
      [
        csvCell(name),
        csvCell(position ?? ""),
        csvCell("TOTAL"),
        "",
        "",
        "",
        "",
        csvCell(minutesToHours(summary.regularMinutes + summary.overtimeMinutes)),
        csvCell(minutesToHours(summary.regularMinutes)),
        csvCell(minutesToHours(summary.overtimeMinutes)),
        csvCell(minutesToHours(summary.leaveMinutes)),
        "",
        csvCell(centsToDollars(summary.totalCents)),
      ].join(",")
    );
  }

  // UTF-8 BOM so Excel opens the file with correct encoding.
  return "﻿" + rows.join("\r\n") + "\r\n";
}
