"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clockIn, clockOut, endBreak, startBreak } from "@/lib/actions/clock";
import { ErrorText } from "@/components/error-text";
import { formatMinutes, formatTime } from "@/lib/format";
import type { ClockPageData } from "@/lib/data/clock";

function msToMinutes(ms: number): number {
  return Math.max(0, Math.floor(ms / 60000));
}

function openEntryWorkedMs(entry: ClockPageData["openEntry"], nowMs: number, breaksUnpaid: boolean): number {
  if (!entry) return 0;
  const clockInMs = new Date(entry.clock_in).getTime();
  let totalMs = nowMs - clockInMs;
  if (breaksUnpaid) {
    for (const b of entry.breaks) {
      const startMs = new Date(b.break_start).getTime();
      const endMs = b.break_end ? new Date(b.break_end).getTime() : nowMs;
      totalMs -= endMs - startMs;
    }
  }
  return Math.max(0, totalMs);
}

function completedTodayMinutes(data: ClockPageData): number {
  return data.todayEntries
    .filter((e) => e.clock_out)
    .reduce((sum, e) => {
      const total = Math.floor((new Date(e.clock_out as string).getTime() - new Date(e.clock_in).getTime()) / 60000);
      if (!data.breaksUnpaid) return sum + total;
      const breakMin = e.breaks.reduce((bSum, b) => {
        if (!b.break_end) return bSum;
        return bSum + Math.floor((new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000);
      }, 0);
      return sum + (total - breakMin);
    }, 0);
}

export function ClockScreen({ data, timeZone }: { data: ClockPageData; timeZone: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (data.status !== "working" && data.status !== "on_break") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [data.status]);

  const isOpenEntryToday = data.openEntry && !data.missedClockOutDate;
  const liveOpenMinutes = isOpenEntryToday ? msToMinutes(openEntryWorkedMs(data.openEntry, now, data.breaksUnpaid)) : 0;
  const todayWorkedMinutes = completedTodayMinutes(data) + liveOpenMinutes;

  const shiftRemaining = data.shiftTargetMinutes - todayWorkedMinutes;
  const progressPct = Math.min(100, Math.round((todayWorkedMinutes / data.shiftTargetMinutes) * 100));

  const weeklyMinutes = data.weeklyMinutesExcludingOpen + liveOpenMinutes;
  const weeklyOvertime = Math.max(0, weeklyMinutes - data.weeklyThresholdMinutes);

  function handleAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  const lastClockOutToday = [...data.todayEntries].reverse().find((e) => e.clock_out)?.clock_out;
  const currentBreakStart = data.openEntry?.breaks.find((b) => !b.break_end)?.break_start;

  return (
    <div>
      {data.missedClockOutDate && (
        <div className="card mb-4 border-amber-200 bg-amber-50">
          <p className="text-sm font-medium text-status-break">
            You didn&rsquo;t clock out on {data.missedClockOutDate}. Please tell your manager so it can be
            corrected.
          </p>
        </div>
      )}

      {data.onApprovedLeaveToday && (
        <span className="chip mb-4 bg-purple-50 text-status-leave">Approved time off today</span>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <StatusHeadline
            status={data.status}
            openEntryClockIn={data.openEntry?.clock_in}
            currentBreakStart={currentBreakStart}
            lastClockOutToday={lastClockOutToday}
            timeZone={timeZone}
          />
        </div>

        <div className="mt-6">
          <p className="text-sm text-muted">Worked today</p>
          <p className="text-4xl font-bold tabular-nums text-ink">{formatMinutes(todayWorkedMinutes)}</p>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-brand-blue transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            {shiftRemaining > 0
              ? `${formatMinutes(shiftRemaining)} left in an ${formatMinutes(data.shiftTargetMinutes)} shift`
              : `${formatMinutes(Math.abs(shiftRemaining))} over an ${formatMinutes(data.shiftTargetMinutes)} shift`}
          </p>
          <p className="mt-1 text-sm text-muted">
            This week: {formatMinutes(weeklyMinutes)} of {formatMinutes(data.weeklyThresholdMinutes)}
            {weeklyOvertime > 0 ? ` · ${formatMinutes(weeklyOvertime)} overtime` : ""}
          </p>
        </div>

        <ErrorText message={error} />

        <div className="mt-6 flex flex-wrap gap-3">
          {data.status === "not_in" || data.status === "clocked_out" ? (
            <button className="btn-primary" disabled={isPending} onClick={() => handleAction(clockIn)}>
              Clock in
            </button>
          ) : null}
          {data.status === "working" ? (
            <>
              <button className="btn-secondary" disabled={isPending} onClick={() => handleAction(startBreak)}>
                Start break
              </button>
              <button className="btn-outline" disabled={isPending} onClick={() => handleAction(clockOut)}>
                Clock out
              </button>
            </>
          ) : null}
          {data.status === "on_break" ? (
            <>
              <button className="btn-secondary" disabled={isPending} onClick={() => handleAction(endBreak)}>
                End break
              </button>
              <button className="btn-outline" disabled={isPending} onClick={() => handleAction(clockOut)}>
                Clock out
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="card mt-4">
        <h2 className="font-semibold text-ink">Today&rsquo;s timeline</h2>
        {data.todayEntries.length === 0 ? (
          <p className="mt-2 text-muted">Nothing yet today.</p>
        ) : (
          <ol className="mt-3 space-y-2 text-sm">
            {data.todayEntries.flatMap((entry) => {
              const items: { label: string; time: string }[] = [
                { label: "Clocked in", time: formatTime(entry.clock_in, timeZone) },
              ];
              for (const b of entry.breaks) {
                items.push({ label: "Break started", time: formatTime(b.break_start, timeZone) });
                if (b.break_end) items.push({ label: "Break ended", time: formatTime(b.break_end, timeZone) });
              }
              if (entry.clock_out) items.push({ label: "Clocked out", time: formatTime(entry.clock_out, timeZone) });
              return items;
            }).map((item, i) => (
              <li key={i} className="flex justify-between border-b border-border pb-2 last:border-0">
                <span className="text-ink">{item.label}</span>
                <span className="text-muted">{item.time}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function StatusHeadline({
  status,
  openEntryClockIn,
  currentBreakStart,
  lastClockOutToday,
  timeZone,
}: {
  status: string;
  openEntryClockIn?: string;
  currentBreakStart?: string;
  lastClockOutToday?: string | null;
  timeZone: string;
}) {
  let text = "Not clocked in";
  let colorClass = "text-status-off";
  if (status === "working" && openEntryClockIn) {
    text = `Working since ${formatTime(openEntryClockIn, timeZone)}`;
    colorClass = "text-status-working";
  } else if (status === "on_break" && currentBreakStart) {
    text = `On break since ${formatTime(currentBreakStart, timeZone)}`;
    colorClass = "text-status-break";
  } else if (status === "clocked_out" && lastClockOutToday) {
    text = `Clocked out at ${formatTime(lastClockOutToday, timeZone)}`;
    colorClass = "text-status-off";
  }
  return <p className={`text-2xl font-bold ${colorClass}`}>{text}</p>;
}
