import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import path from "node:path";
import { formatDate } from "@/lib/format";
import type { ReportData } from "@/lib/data/report";

const BRAND_BLUE = "#1B3F94";
const BRAND_PURPLE = "#7B1C7C";
const MUTED = "#5F6478";
const BORDER = "#E3E4EC";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1A1D2B" },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  logo: { width: 28, height: 28, marginRight: 10 },
  businessName: { fontSize: 16, fontWeight: 700, color: BRAND_BLUE },
  meta: { fontSize: 9, color: MUTED, marginTop: 2 },
  h1: { fontSize: 13, fontWeight: 700, color: BRAND_PURPLE, marginTop: 16, marginBottom: 8 },
  table: { display: "flex", width: "auto", borderStyle: "solid", borderColor: BORDER, borderWidth: 1, borderBottomWidth: 0 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, borderBottomStyle: "solid" },
  headRow: { backgroundColor: "#F7F7FA" },
  totalsRow: { backgroundColor: "#F7F7FA", fontWeight: 700 },
  cell: { padding: 4, borderRightWidth: 1, borderRightColor: BORDER, borderRightStyle: "solid" },
  cellLast: { padding: 4 },
  headCell: { padding: 4, fontWeight: 700, color: MUTED, borderRightWidth: 1, borderRightColor: BORDER, borderRightStyle: "solid" },
});

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function hours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

const SUMMARY_WIDTHS = [16, 12, 9, 10, 10, 10, 10, 11, 12];
const DETAIL_WIDTHS = [12, 16, 16, 10, 10, 10, 10, 10, 10, 12];

export function TimesheetPdf({ data, logoPath }: { data: ReportData; logoPath: string }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop */}
          <Image src={logoPath} style={styles.logo} />
          <View>
            <Text style={styles.businessName}>{data.settings.business_name}</Text>
            <Text style={styles.meta}>
              {formatDate(data.range.start)} – {formatDate(data.range.end)} · Times shown in {data.settings.timezone}
            </Text>
            <Text style={styles.meta}>Generated {new Date().toLocaleDateString("en-US")}</Text>
          </View>
        </View>

        <Text style={styles.h1}>Summary</Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.headRow]} fixed>
            {["Employee", "Position", "Days", "Reg hrs", "OT hrs", "Leave hrs", "Total hrs", "Reg pay", "Amount"].map((h, i) => (
              <Text key={h} style={[i === 8 ? styles.cellLast : styles.headCell, { width: `${SUMMARY_WIDTHS[i]}%` }]}>
                {h}
              </Text>
            ))}
          </View>
          {data.summaries.map((s) => {
            const name = data.employeeNames.get(s.employeeId) ?? "Unknown";
            const position = data.employeePositions.get(s.employeeId) ?? "";
            const cells = [
              name,
              position ?? "",
              String(s.daysWorked),
              hours(s.regularMinutes),
              hours(s.overtimeMinutes),
              hours(s.leaveMinutes),
              hours(s.regularMinutes + s.overtimeMinutes + s.leaveMinutes),
              money(s.regularCents),
              money(s.totalCents),
            ];
            return (
              <View style={styles.row} key={s.employeeId}>
                {cells.map((c, i) => (
                  <Text key={i} style={[i === cells.length - 1 ? styles.cellLast : styles.cell, { width: `${SUMMARY_WIDTHS[i]}%` }]}>
                    {c}
                  </Text>
                ))}
              </View>
            );
          })}
          <View style={[styles.row, styles.totalsRow]}>
            {(() => {
              const totalDays = data.summaries.reduce((a, s) => a + s.daysWorked, 0);
              const totalReg = data.summaries.reduce((a, s) => a + s.regularMinutes, 0);
              const totalOt = data.summaries.reduce((a, s) => a + s.overtimeMinutes, 0);
              const totalLeave = data.summaries.reduce((a, s) => a + s.leaveMinutes, 0);
              const totalRegCents = data.summaries.reduce((a, s) => a + s.regularCents, 0);
              const totalCents = data.summaries.reduce((a, s) => a + s.totalCents, 0);
              const cells = [
                "Total",
                "",
                String(totalDays),
                hours(totalReg),
                hours(totalOt),
                hours(totalLeave),
                hours(totalReg + totalOt + totalLeave),
                money(totalRegCents),
                money(totalCents),
              ];
              return cells.map((c, i) => (
                <Text key={i} style={[i === cells.length - 1 ? styles.cellLast : styles.cell, { width: `${SUMMARY_WIDTHS[i]}%` }]}>
                  {c}
                </Text>
              ));
            })()}
          </View>
        </View>

        {data.summaries.map((s) => {
          const name = data.employeeNames.get(s.employeeId) ?? "Unknown";
          const rows = data.details.filter((d) => d.employeeId === s.employeeId).sort((a, b) => a.date.localeCompare(b.date));
          return (
            <View key={s.employeeId} break>
              <Text style={styles.h1}>{name}</Text>
              <View style={styles.table}>
                <View style={[styles.row, styles.headRow]} fixed>
                  {["Date", "Clock in", "Clock out", "Break", "Reg hrs", "OT hrs", "Leave hrs", "Rate", "Amount", "Note"].map((h, i) => (
                    <Text key={h} style={[i === 9 ? styles.cellLast : styles.headCell, { width: `${DETAIL_WIDTHS[i]}%` }]}>
                      {h}
                    </Text>
                  ))}
                </View>
                {rows.map((r, idx) => {
                  const note = r.kind === "leave" ? `${r.leaveType} leave (approved)` : r.incomplete ? "Incomplete" : r.edited ? "Edited" : "";
                  const cells = [
                    formatDate(r.date),
                    r.clockIn ? new Date(r.clockIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: data.settings.timezone }) : "",
                    r.clockOut ? new Date(r.clockOut).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: data.settings.timezone }) : "",
                    r.breakMinutes ? hours(r.breakMinutes) : "",
                    hours(r.regularMinutes),
                    hours(r.overtimeMinutes),
                    hours(r.leaveMinutes),
                    money(r.rateCents) + "/hr",
                    money(r.totalCents),
                    note,
                  ];
                  return (
                    <View style={styles.row} key={idx}>
                      {cells.map((c, i) => (
                        <Text key={i} style={[i === cells.length - 1 ? styles.cellLast : styles.cell, { width: `${DETAIL_WIDTHS[i]}%` }]}>
                          {c}
                        </Text>
                      ))}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

export const DEFAULT_LOGO_PATH = path.join(process.cwd(), "public", "icons", "icon-192.png");
