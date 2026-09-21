"use client";

import { useState } from "react";

export function Tabs({
  tabs,
  initialActive = 0,
}: {
  tabs: { label: string; content: React.ReactNode }[];
  initialActive?: number;
}) {
  const [active, setActive] = useState(initialActive);

  return (
    <div>
      <div className="flex gap-1 border-b border-border" role="tablist">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={active === i}
            onClick={() => setActive(i)}
            className={`min-h-[44px] border-b-2 px-4 text-sm font-medium ${
              active === i
                ? "border-brand-purple text-brand-purple"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{tabs[active]?.content}</div>
    </div>
  );
}
