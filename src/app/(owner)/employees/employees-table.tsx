"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { formatCents } from "@/lib/format";
import type { EmployeeRow } from "@/lib/data/employees";
import type { CurrentStatus } from "@/lib/supabase/types";

export function EmployeesTable({ employees }: { employees: EmployeeRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        (e.position ?? "").toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
    );
  }, [employees, query]);

  return (
    <div>
      <input
        type="search"
        placeholder="Search by name, position, or email"
        className="input max-w-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search employees"
      />

      {filtered.length === 0 ? (
        <p className="mt-6 text-muted">No employees match your search.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Position</th>
                <th className="py-2 pr-3 font-medium">Rate</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Today</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="py-3 pr-3">
                    <Link href={`/employees/${e.id}`} className="font-medium text-brand-blue hover:underline">
                      {e.full_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 text-muted">{e.position ?? "—"}</td>
                  <td className="py-3 pr-3">
                    {e.current_rate_cents != null ? `${formatCents(e.current_rate_cents)}/hr` : "—"}
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`chip ${e.status === "active" ? "bg-green-50 text-status-working" : "bg-gray-100 text-status-off"}`}>
                      {e.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    {e.today_status ? <StatusPill status={e.today_status as CurrentStatus} /> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
