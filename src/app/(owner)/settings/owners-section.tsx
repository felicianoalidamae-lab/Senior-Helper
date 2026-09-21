"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOwnerRole } from "@/lib/actions/settings";
import type { Profile } from "@/lib/supabase/types";

export function OwnersSection({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function change(id: string, role: "owner" | "employee") {
    setError(null);
    startTransition(async () => {
      const result = await setOwnerRole(id, role);
      if (!result.ok) setError(result.error ?? "Couldn't update.");
      else router.refresh();
    });
  }

  return (
    <div className="card">
      <h2 className="font-semibold text-ink">Owners</h2>
      <p className="mt-1 text-sm text-muted">Owners can manage employees, approve leave, edit time, and run reports.</p>
      {error && <p className="mt-2 text-sm text-status-declined">{error}</p>}
      <ul className="mt-4 space-y-2">
        {profiles.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <span>
              <span className="font-medium text-ink">{p.full_name}</span>{" "}
              <span className="text-sm text-muted">{p.email}</span>
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => change(p.id, p.role === "owner" ? "employee" : "owner")}
              className="btn-outline min-h-[36px] px-3 text-sm"
            >
              {p.role === "owner" ? "Demote to employee" : "Promote to owner"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
