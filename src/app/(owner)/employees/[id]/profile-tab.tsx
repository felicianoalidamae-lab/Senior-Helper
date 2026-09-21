"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/error-text";
import { formatCents, formatDate, parseDollarsToCents } from "@/lib/format";
import { addPayRate, setEmployeeStatus, updateEmployeeProfile } from "@/lib/actions/employees";
import type { PayRate, Profile } from "@/lib/supabase/types";

export function ProfileTab({ profile, rates }: { profile: Profile; rates: PayRate[] }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name);
  const [position, setPosition] = useState(profile.position ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [startDate, setStartDate] = useState(profile.start_date ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [newRate, setNewRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [rateError, setRateError] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);

  const [statusLoading, setStatusLoading] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setSavingProfile(true);
    const result = await updateEmployeeProfile(profile.id, {
      full_name: fullName,
      position: position || null,
      phone: phone || null,
      start_date: startDate || null,
    });
    setSavingProfile(false);
    if (!result.ok) setProfileError(result.error ?? "Couldn't save.");
    else router.refresh();
  }

  async function handleRateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRateError(null);
    const cents = parseDollarsToCents(newRate);
    if (cents == null) {
      setRateError("Enter a valid hourly rate.");
      return;
    }
    setSavingRate(true);
    const result = await addPayRate(profile.id, cents, effectiveFrom);
    setSavingRate(false);
    if (!result.ok) setRateError(result.error ?? "Couldn't save.");
    else {
      setNewRate("");
      router.refresh();
    }
  }

  async function toggleStatus() {
    setStatusLoading(true);
    await setEmployeeStatus(profile.id, profile.status === "active" ? "inactive" : "active");
    setStatusLoading(false);
    router.refresh();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">Profile</h2>
          <span className={`chip ${profile.status === "active" ? "bg-green-50 text-status-working" : "bg-gray-100 text-status-off"}`}>
            {profile.status === "active" ? "Active" : "Inactive"}
          </span>
        </div>
        <form onSubmit={handleProfileSubmit} className="mt-4" noValidate>
          <label className="label" htmlFor="full_name">
            Full name
          </label>
          <input id="full_name" required className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />

          <label className="label mt-4" htmlFor="position">
            Position
          </label>
          <input id="position" className="input" value={position} onChange={(e) => setPosition(e.target.value)} />

          <label className="label mt-4" htmlFor="phone">
            Phone
          </label>
          <input id="phone" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />

          <label className="label mt-4" htmlFor="start_date">
            Start date
          </label>
          <input id="start_date" type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />

          <p className="label mt-4">Email</p>
          <p className="text-ink">{profile.email}</p>

          <ErrorText message={profileError} />

          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={savingProfile} className="btn-primary">
              {savingProfile ? "Saving..." : "Save profile"}
            </button>
            <button
              type="button"
              onClick={toggleStatus}
              disabled={statusLoading}
              className="btn-outline"
            >
              {statusLoading
                ? "Saving..."
                : profile.status === "active"
                  ? "Deactivate"
                  : "Reactivate"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="font-semibold text-ink">Hourly rate</h2>
        <p className="mt-1 text-sm text-muted">
          Changing the rate adds a new entry effective from a date you choose — it never rewrites
          already-reported past pay.
        </p>
        <form onSubmit={handleRateSubmit} className="mt-4 flex flex-wrap items-end gap-3" noValidate>
          <div>
            <label className="label" htmlFor="new_rate">
              New rate (USD/hr)
            </label>
            <input id="new_rate" inputMode="decimal" className="input w-32" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="effective_from">
              Effective from
            </label>
            <input
              id="effective_from"
              type="date"
              className="input w-40"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
          <button type="submit" disabled={savingRate} className="btn-secondary h-[48px]">
            {savingRate ? "Saving..." : "Add rate"}
          </button>
        </form>
        <ErrorText message={rateError} />

        <table className="mt-5 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 font-medium">Effective from</th>
              <th className="py-2 font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="py-2">{formatDate(r.effective_from)}</td>
                <td className="py-2">{formatCents(r.hourly_rate_cents)}/hr</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
