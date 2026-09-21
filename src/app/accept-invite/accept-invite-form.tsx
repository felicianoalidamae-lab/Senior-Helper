"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorText } from "@/components/error-text";

export function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get("code");

    async function establishSession() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError("This link has expired. Ask the owner to resend your invite.");
        }
      }
      setReady(true);
    }
    establishSession();
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("Couldn't set your password. This link may have expired.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="card w-full max-w-sm">
      <h1 className="text-lg font-semibold text-ink">Set your password</h1>
      <p className="mt-1 text-sm text-muted">Choose a password to finish setting up your account.</p>
      <form onSubmit={handleSubmit} className="mt-4" noValidate>
        <label className="label" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!ready}
        />
        <label className="label mt-4" htmlFor="confirm">
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          required
          minLength={8}
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={!ready}
        />
        <ErrorText message={error} />
        <button type="submit" disabled={!ready || loading} className="btn-primary mt-5 w-full">
          {loading ? "Saving..." : "Set password and continue"}
        </button>
      </form>
    </div>
  );
}
