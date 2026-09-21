"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";

export type PeriodPreset = "current" | "previous" | "this_month" | "last_month" | "custom";

export function PeriodSelector({
  defaultPreset = "current",
}: {
  defaultPreset?: PeriodPreset;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preset = (searchParams.get("period") as PeriodPreset) ?? defaultPreset;
  const [customFrom, setCustomFrom] = useState(searchParams.get("from") ?? "");
  const [customTo, setCustomTo] = useState(searchParams.get("to") ?? "");

  function apply(nextPreset: PeriodPreset, from?: string, to?: string) {
    const params = new URLSearchParams();
    params.set("period", nextPreset);
    if (nextPreset === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="period">
          Period
        </label>
        <select
          id="period"
          className="input"
          value={preset}
          onChange={(e) => apply(e.target.value as PeriodPreset, customFrom, customTo)}
        >
          <option value="current">Current pay period</option>
          <option value="previous">Previous pay period</option>
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="custom">Custom range</option>
        </select>
      </div>
      {preset === "custom" && (
        <>
          <div>
            <label className="label" htmlFor="from">
              From
            </label>
            <input
              id="from"
              type="date"
              className="input"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="to">
              To
            </label>
            <input
              id="to"
              type="date"
              className="input"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-outline h-[48px]"
            onClick={() => apply("custom", customFrom, customTo)}
          >
            Apply
          </button>
        </>
      )}
    </div>
  );
}
