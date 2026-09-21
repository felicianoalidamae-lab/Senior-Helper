"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/error-text";
import { updateSettings } from "@/lib/actions/settings";
import type { LeaveType, Settings } from "@/lib/supabase/types";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEAVE_TYPES: { key: LeaveType; label: string }[] = [
  { key: "sick", label: "Sick" },
  { key: "emergency", label: "Emergency" },
  { key: "vacation", label: "Vacation" },
];

function timezoneOptions(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"];
  }
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const timezones = useMemo(timezoneOptions, []);

  const [businessName, setBusinessName] = useState(settings.business_name);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [payPeriodAnchor, setPayPeriodAnchor] = useState(settings.pay_period_anchor);
  const [payPeriodDays, setPayPeriodDays] = useState(String(settings.pay_period_days));
  const [shiftMinutes, setShiftMinutes] = useState(String(settings.shift_target_minutes));
  const [breaksUnpaid, setBreaksUnpaid] = useState(settings.breaks_unpaid);
  const [workDays, setWorkDays] = useState<number[]>(settings.work_days);
  const [paidLeaveTypes, setPaidLeaveTypes] = useState<LeaveType[]>(settings.paid_leave_types);
  const [weekStartDay, setWeekStartDay] = useState(String(settings.week_start_day));
  const [weeklyThreshold, setWeeklyThreshold] = useState(String(settings.weekly_ot_threshold_minutes));
  const [dailyEnabled, setDailyEnabled] = useState(settings.daily_ot_threshold_minutes != null);
  const [dailyThreshold, setDailyThreshold] = useState(String(settings.daily_ot_threshold_minutes ?? 480));
  const [multiplier, setMultiplier] = useState(String(settings.overtime_multiplier_pct));

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  function toggleWorkDay(day: number) {
    setWorkDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }
  function toggleLeaveType(type: LeaveType) {
    setPaidLeaveTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);

    const result = await updateSettings({
      business_name: businessName,
      timezone,
      pay_period_anchor: payPeriodAnchor,
      pay_period_days: Number(payPeriodDays),
      shift_target_minutes: Number(shiftMinutes),
      breaks_unpaid: breaksUnpaid,
      work_days: workDays,
      paid_leave_types: paidLeaveTypes,
      week_start_day: Number(weekStartDay),
      weekly_ot_threshold_minutes: Number(weeklyThreshold),
      daily_ot_threshold_minutes: dailyEnabled ? Number(dailyThreshold) : null,
      overtime_multiplier_pct: Number(multiplier),
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="card">
        <h2 className="font-semibold text-ink">Business</h2>
        <label className="label mt-4" htmlFor="business_name">
          Business name
        </label>
        <input id="business_name" required className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />

        <label className="label mt-4" htmlFor="timezone">
          Time zone
        </label>
        <input
          id="timezone"
          list="tz-list"
          required
          className="input"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        />
        <datalist id="tz-list">
          {timezones.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
      </div>

      <div className="card">
        <h2 className="font-semibold text-ink">Pay period</h2>
        <p className="mt-1 text-sm text-muted">Tip: start pay periods on the same weekday the workweek starts.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="pay_period_anchor">
              Start date of a pay period
            </label>
            <input
              id="pay_period_anchor"
              type="date"
              required
              className="input"
              value={payPeriodAnchor}
              onChange={(e) => setPayPeriodAnchor(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="pay_period_days">
              Length (days)
            </label>
            <input
              id="pay_period_days"
              type="number"
              min={1}
              required
              className="input"
              value={payPeriodDays}
              onChange={(e) => setPayPeriodDays(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-ink">Shift &amp; breaks</h2>
        <label className="label mt-4" htmlFor="shift_minutes">
          Shift length (minutes)
        </label>
        <input
          id="shift_minutes"
          type="number"
          min={1}
          required
          className="input w-40"
          value={shiftMinutes}
          onChange={(e) => setShiftMinutes(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted">{(Number(shiftMinutes) / 60).toFixed(2)} hours</p>

        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={breaksUnpaid} onChange={(e) => setBreaksUnpaid(e.target.checked)} />
          Breaks are unpaid (subtracted from worked time)
        </label>

        <p className="label mt-4">Work days</p>
        <div className="flex flex-wrap gap-3">
          {WEEKDAY_LABELS.map((label, i) => {
            const day = i + 1;
            return (
              <label key={day} className="flex items-center gap-1 text-sm text-ink">
                <input type="checkbox" checked={workDays.includes(day)} onChange={() => toggleWorkDay(day)} />
                {label}
              </label>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-ink">Leave</h2>
        <p className="label mt-4">Paid leave types</p>
        <div className="flex flex-wrap gap-3">
          {LEAVE_TYPES.map((t) => (
            <label key={t.key} className="flex items-center gap-1 text-sm text-ink">
              <input type="checkbox" checked={paidLeaveTypes.includes(t.key)} onChange={() => toggleLeaveType(t.key)} />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-ink">Overtime</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="week_start_day">
              Workweek starts on
            </label>
            <select id="week_start_day" className="input" value={weekStartDay} onChange={(e) => setWeekStartDay(e.target.value)}>
              {WEEKDAY_LABELS.map((label, i) => (
                <option key={i + 1} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="weekly_threshold">
              Weekly overtime threshold (minutes)
            </label>
            <input
              id="weekly_threshold"
              type="number"
              min={1}
              required
              className="input"
              value={weeklyThreshold}
              onChange={(e) => setWeeklyThreshold(e.target.value)}
            />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={dailyEnabled} onChange={(e) => setDailyEnabled(e.target.checked)} />
          Also apply a daily overtime threshold
        </label>
        {dailyEnabled && (
          <input
            type="number"
            min={1}
            className="input mt-2 w-40"
            value={dailyThreshold}
            onChange={(e) => setDailyThreshold(e.target.value)}
          />
        )}

        <label className="label mt-4" htmlFor="multiplier">
          Overtime multiplier (%)
        </label>
        <input
          id="multiplier"
          type="number"
          min={100}
          required
          className="input w-40"
          value={multiplier}
          onChange={(e) => setMultiplier(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted">100 = same rate (1.0×) · 150 = 1.5×</p>
      </div>

      <ErrorText message={error} />
      {saved && <p className="text-sm text-status-working">Settings saved.</p>}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
