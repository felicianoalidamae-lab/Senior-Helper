import { createClient } from "@/lib/supabase/server";
import type { PayRate, Profile } from "@/lib/supabase/types";

export interface EmployeeRow extends Profile {
  current_rate_cents: number | null;
  today_status: string | null;
}

export async function listEmployees(): Promise<EmployeeRow[]> {
  const supabase = createClient();

  const [{ data: profiles }, { data: rates }, { data: board }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "employee").order("full_name"),
    supabase
      .from("pay_rates")
      .select("employee_id, hourly_rate_cents, effective_from")
      .lte("effective_from", new Date().toISOString().slice(0, 10))
      .order("effective_from", { ascending: false }),
    supabase.rpc("today_board"),
  ]);

  const latestRateByEmployee = new Map<string, number>();
  for (const rate of rates ?? []) {
    if (!latestRateByEmployee.has(rate.employee_id)) {
      latestRateByEmployee.set(rate.employee_id, rate.hourly_rate_cents);
    }
  }

  const statusByEmployee = new Map<string, string>();
  for (const row of board ?? []) {
    statusByEmployee.set(row.employee_id, row.status);
  }

  return (profiles ?? []).map((p) => ({
    ...p,
    current_rate_cents: latestRateByEmployee.get(p.id) ?? null,
    today_status: statusByEmployee.get(p.id) ?? null,
  }));
}

export interface EmployeeDetail {
  profile: Profile;
  rates: PayRate[];
}

export async function getEmployeeDetail(id: string): Promise<EmployeeDetail | null> {
  const supabase = createClient();
  const [{ data: profile }, { data: rates }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase
      .from("pay_rates")
      .select("*")
      .eq("employee_id", id)
      .order("effective_from", { ascending: false }),
  ]);

  if (!profile) return null;
  return { profile, rates: rates ?? [] };
}
