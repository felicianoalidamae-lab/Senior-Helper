import type { CurrentStatus } from "@/lib/supabase/types";

const STATUS_META: Record<
  CurrentStatus | "on_leave",
  { label: string; dot: string; bg: string; text: string; icon: string }
> = {
  working: { label: "Working", dot: "bg-status-working", bg: "bg-green-50", text: "text-status-working", icon: "●" },
  on_break: { label: "On break", dot: "bg-status-break", bg: "bg-amber-50", text: "text-status-break", icon: "◐" },
  clocked_out: { label: "Clocked out", dot: "bg-status-off", bg: "bg-gray-100", text: "text-status-off", icon: "○" },
  not_in: { label: "Not in yet", dot: "bg-status-off", bg: "bg-gray-100", text: "text-status-off", icon: "○" },
  on_leave: { label: "On leave", dot: "bg-status-leave", bg: "bg-purple-50", text: "text-status-leave", icon: "◆" },
};

export function StatusPill({
  status,
  detail,
}: {
  status: CurrentStatus | "on_leave";
  detail?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span className={`chip ${meta.bg} ${meta.text}`}>
      <span aria-hidden="true">{meta.icon}</span>
      <span>
        {meta.label}
        {detail ? ` · ${detail}` : ""}
      </span>
    </span>
  );
}
