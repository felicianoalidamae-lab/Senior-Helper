import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { getReportData } from "@/lib/data/report";
import { resolvePeriod } from "@/lib/resolve-period";
import { TimesheetPdf, DEFAULT_LOGO_PATH } from "@/lib/pdf";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role !== "owner") return NextResponse.json({ error: "Owner only." }, { status: 403 });

  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams);
  const settings = await getSettings();
  const range = resolvePeriod(searchParams, settings);
  const employeeId = searchParams.employee && searchParams.employee !== "all" ? searchParams.employee : undefined;

  const data = await getReportData(range, employeeId);
  const buffer = await renderToBuffer(<TimesheetPdf data={data} logoPath={DEFAULT_LOGO_PATH} />);
  const filename = `senior-helpers-timesheet_${range.start}_to_${range.end}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
