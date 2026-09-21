"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { PeriodPreset } from "@/components/period-selector";

export function ReportFilters({ employees }: { employees: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const period = (searchParams.get("period") as PeriodPreset) ?? "current";
  const employee = searchParams.get("employee") ?? "all";
  const [customFrom, setCustomFrom] = useState(searchParams.get("from") ?? "");
  const [customTo, setCustomTo] = useState(searchParams.get("to") ?? "");

  function apply(next: { period?: string; employee?: string; from?: string; to?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.period) {
      params.set("period", next.period);
      if (next.period !== "custom") {
        params.delete("from");
        params.delete("to");
      }
    }
    if (next.employee) params.set("employee", next.employee);
    if (next.period === "custom") {
      if (next.from) params.set("from", next.from);
      if (next.to) params.set("to", next.to);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="period">
          Period
        </label>
        <select id="period" className="input" value={period} onChange={(e) => apply({ period: e.target.value })}>
          <option value="current">Current pay period</option>
          <option value="previous">Previous pay period</option>
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="custom">Custom range</option>
        </select>
      </div>

      {period === "custom" && (
        <>
          <div>
            <label className="label" htmlFor="from">
              From
            </label>
            <input id="from" type="date" className="input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="to">
              To
            </label>
            <input id="to" type="date" className="input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
          <button
            type="button"
            className="btn-outline h-[48px]"
            onClick={() => apply({ period: "custom", from: customFrom, to: customTo })}
          >
            Apply
          </button>
        </>
      )}

      <div>
        <label className="label" htmlFor="employee">
          Employee
        </label>
        <select id="employee" className="input" value={employee} onChange={(e) => apply({ employee: e.target.value })}>
          <option value="all">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
