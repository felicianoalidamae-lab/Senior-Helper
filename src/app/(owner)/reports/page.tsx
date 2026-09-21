import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { getReportData } from "@/lib/data/report";
import { resolvePeriod } from "@/lib/resolve-period";
import { formatDate } from "@/lib/format";
import { ReportFilters } from "./report-filters";
import { SummaryTable } from "./summary-table";
import { DetailSection } from "./detail-section";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const settings = await getSettings();
  const range = resolvePeriod(searchParams, settings);
  const employeeId = typeof searchParams.employee === "string" && searchParams.employee !== "all" ? searchParams.employee : undefined;

  const supabase = createClient();
  const [{ data: employees }, data] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "employee").order("full_name"),
    getReportData(range, employeeId),
  ]);

  const downloadParams = new URLSearchParams();
  downloadParams.set("period", typeof searchParams.period === "string" ? searchParams.period : "current");
  if (typeof searchParams.from === "string") downloadParams.set("from", searchParams.from);
  if (typeof searchParams.to === "string") downloadParams.set("to", searchParams.to);
  downloadParams.set("employee", employeeId ?? "all");

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">Reports</h1>

      <div className="card mt-4">
        <ReportFilters employees={employees ?? []} />
        <p className="mt-3 text-sm text-muted">
          {formatDate(range.start)} – {formatDate(range.end)} · Times shown in {settings.timezone}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={`/api/reports/csv?${downloadParams.toString()}`} className="btn-outline">
            Download CSV
          </a>
          <a href={`/api/reports/pdf?${downloadParams.toString()}`} className="btn-outline">
            Download PDF
          </a>
        </div>
      </div>

      <div className="card mt-4">
        <h2 className="font-semibold text-ink">Summary</h2>
        {data.summaries.length === 0 ? (
          <p className="mt-2 text-muted">No pay data for this period yet.</p>
        ) : (
          <div className="mt-3">
            <SummaryTable
              summaries={data.summaries}
              employeeNames={data.employeeNames}
              employeePositions={data.employeePositions}
              employeeRates={data.employeeRates}
            />
          </div>
        )}
      </div>

      {data.summaries.length > 0 && (
        <div className="mt-4 space-y-3">
          {data.summaries.map((s) => (
            <DetailSection
              key={s.employeeId}
              summary={s}
              rows={data.details.filter((d) => d.employeeId === s.employeeId)}
              employeeName={data.employeeNames.get(s.employeeId) ?? "Unknown"}
              timeZone={settings.timezone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
