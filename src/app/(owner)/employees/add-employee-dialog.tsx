"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/error-text";
import { parseDollarsToCents } from "@/lib/format";

export function AddEmployeeDialog() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [rate, setRate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }
  function close() {
    dialogRef.current?.close();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const hourly_rate_cents = parseDollarsToCents(rate);
    if (!fullName.trim() || !email.trim()) {
      setError("Full name and email are required.");
      return;
    }
    if (hourly_rate_cents == null) {
      setError("Enter a valid hourly rate.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/employees/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        email,
        position: position || undefined,
        phone: phone || undefined,
        start_date: startDate || undefined,
        hourly_rate_cents,
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't add the employee. Check your connection and try again.");
      return;
    }

    setFullName("");
    setEmail("");
    setPosition("");
    setRate("");
    setStartDate("");
    setPhone("");
    close();
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={open}>
        Add employee
      </button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-border bg-surface p-0 backdrop:bg-black/40"
      >
        <form onSubmit={handleSubmit} className="p-5" noValidate>
          <h2 className="text-lg font-semibold text-ink">Add employee</h2>
          <p className="mt-1 text-sm text-muted">They&rsquo;ll get an email invite to set their password.</p>

          <label className="label mt-4" htmlFor="full_name">
            Full name
          </label>
          <input id="full_name" required className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />

          <label className="label mt-4" htmlFor="email">
            Email
          </label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />

          <label className="label mt-4" htmlFor="position">
            Position
          </label>
          <input id="position" className="input" value={position} onChange={(e) => setPosition(e.target.value)} />

          <label className="label mt-4" htmlFor="rate">
            Hourly rate (USD)
          </label>
          <input id="rate" inputMode="decimal" required className="input" placeholder="20.00" value={rate} onChange={(e) => setRate(e.target.value)} />

          <label className="label mt-4" htmlFor="start_date">
            Start date
          </label>
          <input id="start_date" type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />

          <label className="label mt-4" htmlFor="phone">
            Phone (optional)
          </label>
          <input id="phone" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />

          <ErrorText message={error} />

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={close} className="btn-outline flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Adding..." : "Send invite"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
